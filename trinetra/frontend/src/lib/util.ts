export function sevClass(sev: string) {
  return `pill sev-${sev}`;
}

export function riskColor(r: number) {
  if (r >= 70) return "#e2424a";
  if (r >= 50) return "#e8732c";
  if (r >= 30) return "#d7a21a";
  return "#3f8f5b";
}

export function sevFromRisk(r: number) {
  if (r >= 70) return "critical";
  if (r >= 50) return "high";
  if (r >= 30) return "medium";
  return "low";
}

export function fmtTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export const ROLE_LABEL: Record<string, string> = {
  admin_satsiber: "Admin Satsiber",
  csirt_analyst: "CSIRT Analyst",
  team_lead: "Team Lead",
  operator: "Operator",
  data_custodian: "Data Custodian",
  personel: "Personel",
  auditor: "Auditor",
};

export const CAT_LABEL: Record<string, string> = {
  data_exfiltration: "Eksfiltrasi Data",
  privilege_abuse: "Privilege Abuse",
  lateral_movement: "Lateral Movement",
  logon_anomaly: "Anomali Logon",
  suspicious_process: "Proses Mencurigakan",
  mass_file_access: "Mass File Access",
  usb_exfiltration: "USB Exfiltration",
  config_tampering: "Config Tampering",
};
