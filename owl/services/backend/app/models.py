"""Skema telemetri dan keluaran OWL.

Telemetri sengaja berisi INDIKATOR, bukan konten. Tidak ada isi pesan, isi
berkas, daftar kontak, atau lokasi presisi di dalam skema ini, dan tidak ada
tempat untuk menaruhnya.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Severity = Literal["low", "medium", "high", "critical"]
# FR-03: indikator yang tidak dapat diakses API Android ditandai apa adanya,
# bukan dikarang nilainya. Daftar kosong dari indikator yang TIDAK TERBACA
# tidak sama artinya dengan daftar kosong dari indikator yang sudah diperiksa
# dan memang bersih, dan keduanya tidak boleh tampil sama di dashboard.
Availability = Literal["ok", "partial", "unavailable", "not_supported"]
Category = Literal["runtime", "app", "config", "device", "identity"]
Decision = Literal["allow", "step_up", "limited", "deny"]
Sensitivity = Literal["standard", "classified"]


# ——————————————————————————— masukan ———————————————————————————

class Attestation(BaseModel):
    """Bukti bahwa agent pengirim adalah build asli (deepdive §7.4)."""
    play_integrity: Literal["MEETS_STRONG_INTEGRITY", "MEETS_DEVICE_INTEGRITY",
                            "MEETS_BASIC_INTEGRITY", "FAILED", "UNAVAILABLE"] = "UNAVAILABLE"
    key_attestation: bool = False
    certificate_chain_sha256: str = ""
    verified_at: datetime | None = None


class AccessibilityService(BaseModel):
    package: str
    label: str = ""


class UserCertificate(BaseModel):
    subject: str
    sha256: str = ""


class VpnProfile(BaseModel):
    name: str
    package: str = ""


class InstalledApp(BaseModel):
    package: str
    installer: str = ""           # kosong berarti tidak diketahui, bukan aman
    permissions: list[str] = Field(default_factory=list)


class IntegrityBlock(BaseModel):
    play_integrity: str = "UNAVAILABLE"
    root_artifacts: list[str] = Field(default_factory=list)
    bootloader_unlocked: bool = False
    security_patch: str = ""      # format YYYY-MM-DD seperti Build.VERSION


class NetworkBlock(BaseModel):
    egress_mb_24h: float = 0.0
    screen_on_ratio_24h: float = 1.0   # 0 berarti perangkat tidak disentuh
    unusual_destinations: list[str] = Field(default_factory=list)
    new_destinations: list[str] = Field(default_factory=list)
    beacon_jitter_pct: float = 100.0   # makin kecil makin teratur


class IndicatorStatus(BaseModel):
    """Status satu indikator pada satu pemeriksaan (FR-02 dan FR-03)."""
    status: Availability = "ok"
    reason: str = ""              # wajib diisi jika status bukan ok
    source: str = "agent"         # agent | resolver | mdm
    checked_at: datetime | None = None


# Kunci indikator yang dikenal sistem. Nama ini dipakai agent, mesin aturan,
# dan dashboard, sehingga ketiganya tidak dapat berbeda diam-diam.
INDICATOR_KEYS = (
    "permissions",            # 1 izin aplikasi
    "accessibility",          # 2 layanan aksesibilitas dan hamparan
    "certificates",           # 3a sertifikat CA pengguna
    "vpn",                    # 3b profil VPN
    "install_source",         # 4 sumber pemasangan
    "integrity",              # 5 integritas perangkat dan patch
    "network_volume",         # 6a volume keluar dan rasio layar
    "network_destinations",   # 6b tujuan jaringan
    "attestation",            # syarat kepercayaan laporan
)


class Telemetry(BaseModel):
    device_id: str
    collected_at: datetime
    agent_version: str = ""
    attestation: Attestation = Field(default_factory=Attestation)
    accessibility_services: list[AccessibilityService] = Field(default_factory=list)
    overlay_packages: list[str] = Field(default_factory=list)
    user_certificates: list[UserCertificate] = Field(default_factory=list)
    vpn_profiles: list[VpnProfile] = Field(default_factory=list)
    apps: list[InstalledApp] = Field(default_factory=list)
    integrity: IntegrityBlock = Field(default_factory=IntegrityBlock)
    network: NetworkBlock = Field(default_factory=NetworkBlock)
    # Dibiarkan kosong berarti agent lama yang belum melaporkan status.
    # Backend memperlakukannya sebagai "ok" supaya tidak memecah kompatibilitas,
    # dan dashboard menandainya sebagai status tidak dilaporkan.
    availability: dict[str, IndicatorStatus] = Field(default_factory=dict)


class Device(BaseModel):
    device_id: str
    label: str = ""
    owner_role: str = ""          # peran, bukan nama orang
    unit: str = ""
    model: str = ""
    os_version: str = ""


# ——————————————————————————— keluaran ———————————————————————————

class Finding(BaseModel):
    rule_id: str
    category: Category
    severity: Severity
    base_severity: Severity
    title: str
    detail: str
    mitre: str = ""
    confidence: str = ""
    evidence: list[str] = Field(default_factory=list)
    downgraded: bool = False      # true jika diturunkan karena berdiri sendiri
    points: float = 0.0           # sumbangan ke skor, diisi oleh scoring


class CategoryScore(BaseModel):
    category: Category
    weight: float
    severity_sum: float
    score: float
    saturated: bool


class RiskAssessment(BaseModel):
    device_id: str
    assessed_at: datetime
    score: float
    level: Literal["rendah", "sedang", "tinggi", "kritis"]
    findings: list[Finding]
    categories: list[CategoryScore]
    decay_applied: float = 0.0
    previous_score: float | None = None
    attestation_ok: bool = True
    availability: dict[str, IndicatorStatus] = Field(default_factory=dict)
    skipped_rules: list[str] = Field(default_factory=list)


class AccessDecision(BaseModel):
    device_id: str
    resource: Sensitivity
    decision: Decision
    score: float
    reason: str
    quarantine: bool = False
    top_contributors: list[str] = Field(default_factory=list)
