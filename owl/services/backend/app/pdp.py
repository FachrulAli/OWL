"""Policy Decision Point: skor risiko menjadi keputusan akses (deepdive §7.3).

CATATAN PENTING TENTANG PENEGAKAN. Pada purwarupa ini keluarannya adalah
REKOMENDASI keputusan akses. Pemblokiran yang sungguh-sungguh menuntut
integrasi dengan mekanisme penegak, yaitu gateway, IAM, atau MDM satuan.
Requirements §8 meminta pembedaan itu dinyatakan, bukan dikaburkan, dan
dashboard menyebutnya demikian di layar.

Catatan atas satu ketidakcocokan di dokumen sumber. Tabel ambang pada
proposal §4 menempatkan deny dan karantina di 90 ke atas, sedangkan naskah
demo menyatakan perangkat berskor 87 DITOLAK. Keduanya dapat berdiri
bersama jika keputusan tidak hanya bergantung pada skor, melainkan juga pada
apa yang hendak diakses. Itulah yang diterapkan di sini, dan itu pula yang
dimaksud Zero Trust: tidak ada satu ambang tunggal untuk seluruh sumber daya.

    sumber daya biasa        : deny mulai 90
    sumber daya terklasifikasi: deny mulai 70

Perangkat berskor 87 karena itu lolos ke jaringan biasa dengan pembatasan,
dan ditolak di gerbang sistem terklasifikasi. Demo memakai gerbang yang
kedua, sesuai use case pre-deployment screening.

DUA LAPIS KEPUTUSAN. Skor hanya menimbang yang ambigu. Tiga keadaan diputus
SEBELUM skor dilihat, karena ketiganya pasti, bukan indikasi:

    1. laporan kedaluwarsa   penilaian terakhir lebih tua dari ambang. Perangkat
                             yang berhenti melapor bukan perangkat yang aman,
                             dan skor lamanya tidak menggambarkan keadaan kini.
    2. attestation tidak sah laporan tidak dipercaya sama sekali.
    3. aturan penentu        temuan bertanda `decisive` pada severitas critical:
                             aplikasi di daftar larangan, integritas gagal.

Tanpa lapis ini, perangkat ber-root hanya memperoleh 15 poin dan lolos, dan
payload uji pada HP sungguhan hanya memperoleh Step-up. Keduanya ditemukan
2026-11-15 saat OWL pertama kali dijalankan pada perangkat fisik.
"""
from __future__ import annotations

from datetime import datetime, timezone

from . import policy, rules
from .models import AccessDecision, RiskAssessment, Sensitivity

# Penamaan mengikuti Requirements §3.3: Allow, Step-up, Restrict,
# Deny/Quarantine. Padanan Indonesianya dipakai di dashboard.
_REASON = {
    "allow": "Allow. Skor di bawah ambang, akses penuh direkomendasikan.",
    "step_up": "Step-up. Skor sedang, akses direkomendasikan setelah verifikasi tambahan (MFA).",
    "limited": "Restrict. Skor tinggi, akses ke sumber daya sensitif direkomendasikan dibatasi.",
    "deny": "Deny / Quarantine. Skor melewati ambang untuk sumber daya ini; "
            "akses direkomendasikan ditolak dan perangkat dikarantina.",
}


def _age_minutes(a: RiskAssessment, now: datetime) -> float:
    at = a.assessed_at
    if at.tzinfo is None:
        at = at.replace(tzinfo=timezone.utc)
    return (now - at).total_seconds() / 60.0


def decide(a: RiskAssessment, resource: Sensitivity = "standard",
           now: datetime | None = None) -> AccessDecision:
    s = a.score
    now = now or datetime.now(timezone.utc)

    # Lapis 1: laporan kedaluwarsa. Diukur dari waktu penilaian di SERVER,
    # bukan dari jam perangkat, sehingga agent tidak dapat memudakannya.
    max_age = float(rules.catalog().get("parameters", {}).get("max_report_age_minutes", 0) or 0)
    age = _age_minutes(a, now)
    if max_age > 0 and age > max_age:
        return AccessDecision(
            device_id=a.device_id, resource=resource, decision="deny", score=s,
            reason=(f"Laporan kedaluwarsa. Penilaian terakhir {age:.0f} menit lalu, "
                    f"melewati ambang {max_age:.0f} menit. Keadaan perangkat saat ini "
                    "tidak diketahui; akses direkomendasikan ditolak sampai agent melapor lagi."),
            quarantine=False,
            top_contributors=["laporan kedaluwarsa"],
        )

    # Attestation gagal mendahului seluruh perhitungan. Laporan dari agent
    # yang tidak terverifikasi tidak dipercaya, termasuk ketika laporan itu
    # menyatakan perangkatnya bersih.
    if not a.attestation_ok:
        return AccessDecision(
            device_id=a.device_id, resource=resource, decision="deny", score=s,
            reason="Attestation agent tidak sah. Laporan perangkat ini tidak dipercaya.",
            quarantine=True,
            top_contributors=["OWL-X01 attestation agent tidak sah"],
        )

    # Lapis 3: aturan penentu. Kecocokan pasti menolak tanpa melihat skor.
    decisive = [f for f in a.findings if f.decisive]
    if decisive:
        names = "; ".join(f"{f.rule_id} {f.title.lower()}" for f in decisive)
        return AccessDecision(
            device_id=a.device_id, resource=resource, decision="deny", score=s,
            reason=f"Deny / Quarantine. Aturan penentu menyala, skor tidak ditimbang: {names}.",
            quarantine=True,
            top_contributors=[f"{f.rule_id} {f.title.lower()} (penentu)" for f in decisive],
        )

    th = policy.thresholds()
    deny_at = th["high"] if resource == "classified" else th["critical"]

    if s >= deny_at:
        decision = "deny"
    elif s >= th["high"]:
        decision = "limited"
    elif s >= th["medium"]:
        decision = "step_up"
    else:
        decision = "allow"

    top = [f"{f.rule_id} {f.title.lower()} ({f.points:+.0f})"
           for f in sorted(a.findings, key=lambda f: -f.points)[:3] if f.points > 0]

    return AccessDecision(
        device_id=a.device_id, resource=resource, decision=decision, score=s,
        reason=_REASON[decision], quarantine=(decision == "deny"),
        top_contributors=top,
    )
