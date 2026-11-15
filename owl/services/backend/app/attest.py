"""Verifikasi Android Key Attestation, sepenuhnya luring (deepdive §7.4).

Sebelum modul ini ada, OWL Core memercayai `key_attestation: true` yang
dikirim agent. Agent yang dikuasai penyerang cukup mengirim `true`. Sekarang
buktinya diperiksa di sini, dan hasilnya menggantikan klaim agent.

Yang dibuktikan satu rantai sertifikat yang sah:

  1. Rantainya berujung pada akar attestation Google yang disematkan di
     `rules/google-attestation-roots.pem`. Tidak ada panggilan keluar.
  2. Kunci agent lahir di perangkat keras (TEE atau StrongBox), bukan di
     perangkat lunak yang dapat ditiru.
  3. Kunci itu dibuat UNTUK tantangan yang baru saja diberikan OWL Core,
     sehingga rantai lama tidak dapat diputar ulang.
  4. Keadaan boot perangkat menurut perangkat keras: terkunci dan
     terverifikasi, atau tidak. Ini menggantikan tebakan bootloader di agent.
  5. Aplikasi yang meminta kunci itu: nama paket dan sidik penanda tangannya.

BATAS YANG JUJUR
- Masa berlaku sertifikat TIDAK ditegakkan. Sertifikat attestation di
  lapangan sering bertanggal aneh (mulai 1970, atau perantara yang sudah
  lewat), dan menolaknya akan menolak perangkat yang sah.
- Daftar pencabutan Google (kunci attestation yang bocor) belum diperiksa.
  Pada jaringan tertutup daftar itu harus dibawa masuk lewat berkas; itu
  pekerjaan berikutnya, dan tanpa itu kunci pabrik yang bocor masih diterima.
- Emulator tidak punya kunci attestation Google, jadi rantainya ditolak di
  sini. Itu benar, bukan cacat.
"""
from __future__ import annotations

import base64
import hashlib
from dataclasses import asdict, dataclass, field
from pathlib import Path

from cryptography import x509
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, padding, rsa

ROOTS_PATH = Path(__file__).resolve().parent.parent / "rules" / "google-attestation-roots.pem"
KEY_DESCRIPTION_OID = x509.ObjectIdentifier("1.3.6.1.4.1.11129.2.1.17")

SECURITY_LEVEL = {0: "software", 1: "tee", 2: "strongbox"}
BOOT_STATE = {0: "verified", 1: "self_signed", 2: "unverified", 3: "failed"}

# Tag pada AuthorizationList yang dibaca OWL.
TAG_ROOT_OF_TRUST = 704
TAG_OS_VERSION = 705
TAG_OS_PATCH_LEVEL = 706
TAG_ATTESTATION_APPLICATION_ID = 709


class AttestationError(Exception):
    """Rantai tidak dapat diterima. Pesannya ditampilkan ke analis apa adanya."""


@dataclass
class AttestationResult:
    verified: bool = False            # rantai sah sampai akar Google
    hardware_backed: bool = False     # kunci lahir di TEE atau StrongBox
    reason: str = ""                  # mengapa tidak, jika tidak
    security_level: str = ""          # software | tee | strongbox
    boot_state: str = ""              # verified | self_signed | unverified | failed
    device_locked: bool | None = None
    os_patch_level: str = ""          # YYYY-MM menurut perangkat keras
    app_package: str = ""
    app_signers: list[str] = field(default_factory=list)   # SHA-256 heksadesimal
    root_subject: str = ""
    chain_sha256: str = ""
    public_key_b64: str = ""          # SubjectPublicKeyInfo DER, kunci agent

    @property
    def trusted(self) -> bool:
        """Laporan dari kunci ini boleh dipercaya."""
        return self.verified and self.hardware_backed

    @property
    def boot_ok(self) -> bool:
        return self.boot_state == "verified" and self.device_locked is True

    def to_dict(self) -> dict:
        return asdict(self)


# ——————————————————————————— DER secukupnya ———————————————————————————
#
# `cryptography` membaca X.509, tetapi isi ekstensi attestation adalah ASN.1
# biasa yang harus dibaca sendiri. Pembaca di bawah hanya mengenal yang
# dibutuhkan: panjang pasti, dan tag bernomor tinggi (704 dan seterusnya).

@dataclass
class _Node:
    cls: int            # 0 universal, 2 context-specific
    constructed: bool
    tag: int
    value: bytes

    def children(self) -> list["_Node"]:
        return _parse_all(self.value)

    def as_int(self) -> int:
        return int.from_bytes(self.value, "big", signed=True) if self.value else 0


def _parse_one(data: bytes, pos: int) -> tuple[_Node, int]:
    if pos >= len(data):
        raise AttestationError("ekstensi attestation terpotong")
    first = data[pos]
    pos += 1
    cls, constructed, tag = first >> 6, bool(first & 0x20), first & 0x1F
    if tag == 0x1F:                               # tag bernomor tinggi
        tag = 0
        while True:
            if pos >= len(data):
                raise AttestationError("tag ASN.1 terpotong")
            b = data[pos]
            pos += 1
            tag = (tag << 7) | (b & 0x7F)
            if not b & 0x80:
                break
    if pos >= len(data):
        raise AttestationError("panjang ASN.1 terpotong")
    length = data[pos]
    pos += 1
    if length & 0x80:
        n = length & 0x7F
        if n == 0 or n > 4 or pos + n > len(data):
            raise AttestationError("panjang ASN.1 tidak didukung")
        length = int.from_bytes(data[pos:pos + n], "big")
        pos += n
    if pos + length > len(data):
        raise AttestationError("isi ASN.1 melewati batas")
    return _Node(cls, constructed, tag, data[pos:pos + length]), pos + length


def _parse_all(data: bytes) -> list[_Node]:
    out, pos = [], 0
    while pos < len(data):
        node, pos = _parse_one(data, pos)
        out.append(node)
    return out


def _auth_list(node: _Node) -> dict[int, _Node]:
    """AuthorizationList: tiap ruas berbungkus tag konteks EXPLICIT."""
    out: dict[int, _Node] = {}
    for item in node.children():
        if item.cls == 2:
            inner = item.children()
            if inner:
                out[item.tag] = inner[0]
    return out


def _parse_key_description(ext: bytes) -> dict:
    top = _parse_all(ext)
    if len(top) != 1 or top[0].tag != 0x10:
        raise AttestationError("ekstensi attestation bukan SEQUENCE")
    seq = top[0].children()
    if len(seq) < 8:
        raise AttestationError("KeyDescription tidak lengkap")
    sw, tee = _auth_list(seq[6]), _auth_list(seq[7])

    out: dict = {
        "security_level": SECURITY_LEVEL.get(seq[1].as_int(), "software"),
        "challenge": seq[4].value,
    }

    # Akar kepercayaan hanya bermakna dari daftar yang ditegakkan perangkat
    # keras. Yang berasal dari daftar perangkat lunak dapat ditulis siapa saja.
    rot = tee.get(TAG_ROOT_OF_TRUST)
    if rot is not None:
        parts = rot.children()
        if len(parts) >= 3:
            out["device_locked"] = parts[1].value != b"\x00"
            out["boot_state"] = BOOT_STATE.get(parts[2].as_int(), "failed")

    patch = tee.get(TAG_OS_PATCH_LEVEL) or sw.get(TAG_OS_PATCH_LEVEL)
    if patch is not None:
        v = patch.as_int()                       # YYYYMM
        if v > 0:
            out["os_patch_level"] = f"{v // 100:04d}-{v % 100:02d}"

    app = sw.get(TAG_ATTESTATION_APPLICATION_ID) or tee.get(TAG_ATTESTATION_APPLICATION_ID)
    if app is not None:
        try:
            inner = _parse_all(app.value)[0].children()
            pkgs = [p.children()[0].value.decode("utf-8", "replace")
                    for p in inner[0].children() if p.children()]
            out["app_package"] = pkgs[0] if pkgs else ""
            out["app_signers"] = [d.value.hex() for d in inner[1].children()] if len(inner) > 1 else []
        except (IndexError, AttestationError):
            pass                                  # identitas aplikasi tidak terbaca
    return out


# ——————————————————————————— rantai ———————————————————————————

_roots_cache: list[x509.Certificate] | None = None


def trusted_roots() -> list[x509.Certificate]:
    global _roots_cache
    if _roots_cache is None:
        _roots_cache = x509.load_pem_x509_certificates(ROOTS_PATH.read_bytes())
    return _roots_cache


def _spki(cert_or_key) -> bytes:
    key = cert_or_key.public_key() if isinstance(cert_or_key, x509.Certificate) else cert_or_key
    return key.public_bytes(serialization.Encoding.DER,
                            serialization.PublicFormat.SubjectPublicKeyInfo)


def _signed_by(child: x509.Certificate, issuer_key) -> bool:
    alg = child.signature_hash_algorithm
    try:
        if isinstance(issuer_key, rsa.RSAPublicKey):
            issuer_key.verify(child.signature, child.tbs_certificate_bytes,
                              padding.PKCS1v15(), alg)
        elif isinstance(issuer_key, ec.EllipticCurvePublicKey):
            issuer_key.verify(child.signature, child.tbs_certificate_bytes, ec.ECDSA(alg))
        else:
            return False
        return True
    except (InvalidSignature, TypeError, ValueError):
        return False


def verify_chain(chain_b64: list[str], challenge: bytes,
                 roots: list[x509.Certificate] | None = None) -> AttestationResult:
    """Periksa rantai attestation. Tidak pernah melempar: kegagalan kembali
    sebagai `verified=False` beserta alasannya, supaya dapat dicatat."""
    res = AttestationResult()
    try:
        if not chain_b64:
            raise AttestationError("agent tidak mengirim rantai attestation")
        if len(chain_b64) > 10:
            raise AttestationError("rantai attestation terlalu panjang")
        try:
            ders = [base64.b64decode(c, validate=True) for c in chain_b64]
            certs = [x509.load_der_x509_certificate(d) for d in ders]
        except Exception:
            raise AttestationError("rantai attestation tidak dapat dibaca sebagai X.509")

        res.chain_sha256 = hashlib.sha256(b"".join(ders)).hexdigest()
        leaf = certs[0]
        res.public_key_b64 = base64.b64encode(_spki(leaf)).decode("ascii")

        # Isi ekstensi dibaca lebih dahulu, supaya analis tetap melihat apa
        # yang DIKLAIM rantai itu walau rantainya kemudian ditolak.
        try:
            ext = leaf.extensions.get_extension_for_oid(KEY_DESCRIPTION_OID)
        except x509.ExtensionNotFound:
            raise AttestationError("sertifikat kunci tidak membawa ekstensi attestation")
        kd = _parse_key_description(ext.value.value)
        res.security_level = kd["security_level"]
        res.boot_state = kd.get("boot_state", "")
        res.device_locked = kd.get("device_locked")
        res.os_patch_level = kd.get("os_patch_level", "")
        res.app_package = kd.get("app_package", "")
        res.app_signers = kd.get("app_signers", [])
        res.hardware_backed = res.security_level in ("tee", "strongbox")

        # Tiap sertifikat ditandatangani sertifikat sesudahnya.
        for child, issuer in zip(certs, certs[1:]):
            if not _signed_by(child, issuer.public_key()):
                raise AttestationError("tanda tangan di dalam rantai attestation tidak sah")

        # Ujung rantai harus kunci akar yang disematkan. Dibandingkan lewat
        # kunci publiknya, bukan lewat nama, sebab nama dapat ditiru.
        last = certs[-1]
        pinned = {_spki(r): r for r in (roots if roots is not None else trusted_roots())}
        root = pinned.get(_spki(last))
        if root is None:
            # Rantai yang tidak menyertakan akarnya: sertifikat terakhir harus
            # ditandatangani salah satu akar yang disematkan.
            root = next((r for r in pinned.values() if _signed_by(last, r.public_key())), None)
        elif not _signed_by(last, root.public_key()):
            root = None
        if root is None:
            raise AttestationError(
                "rantai tidak berujung pada akar attestation Google; "
                "kunci ini tidak terbukti lahir di perangkat keras yang sah")
        res.root_subject = root.subject.rfc4514_string()

        if kd["challenge"] != challenge:
            raise AttestationError("tantangan pada rantai tidak cocok dengan yang diberikan OWL Core")

        res.verified = True
        if not res.hardware_backed:
            res.reason = "kunci dibuat di perangkat lunak, bukan di TEE atau StrongBox"
    except AttestationError as e:
        res.verified = False
        res.reason = str(e)
    return res


# ——————————————————————————— tanda tangan laporan ———————————————————————————

def verify_signature(public_key_b64: str, body: bytes, signature_b64: str) -> bool:
    """Tanda tangan ECDSA-SHA256 atas badan laporan, oleh kunci agent."""
    try:
        key = serialization.load_der_public_key(base64.b64decode(public_key_b64))
        sig = base64.b64decode(signature_b64, validate=True)
        if not isinstance(key, ec.EllipticCurvePublicKey):
            return False
        key.verify(sig, body, ec.ECDSA(hashes.SHA256()))
        return True
    except Exception:
        return False
