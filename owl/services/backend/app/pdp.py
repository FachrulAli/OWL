"""Policy Decision Point: skor risiko menjadi keputusan akses (deepdive §7.3).

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

from .config import settings
from .models import AccessDecision, RiskAssessment, Sensitivity

_REASON = {
    "allow": "Skor di bawah ambang. Akses penuh diberikan.",
    "step_up": "Skor sedang. Akses diberikan setelah verifikasi tambahan (MFA).",
    "limited": "Skor tinggi. Akses dibatasi pada sumber daya tidak sensitif.",
    "deny": "Skor melewati ambang untuk sumber daya ini. Akses ditolak dan perangkat dikarantina.",
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

    deny_at = settings.T_HIGH if resource == "classified" else settings.T_CRITICAL

    if s >= deny_at:
        decision = "deny"
    elif s >= settings.T_HIGH:
        decision = "limited"
    elif s >= settings.T_MEDIUM:
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
