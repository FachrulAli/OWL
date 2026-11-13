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
"""
from __future__ import annotations

from . import policy
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


def decide(a: RiskAssessment, resource: Sensitivity = "standard") -> AccessDecision:
    s = a.score

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
