#!/usr/bin/env bash
# Unduh/perbarui indikator spyware publik (STIX2). Lihat ATTRIBUTION.md.
# Skrip ini hanya mengunduh berkas data; tidak ada kode pihak ketiga yang dijalankan.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/stix2"
mkdir -p "$DIR"

MVT_BASE="https://raw.githubusercontent.com/mvt-project/mvt-indicators/main"
AMNESTY="https://raw.githubusercontent.com/AmnestyTech/investigations/master"

PATHS=(
  "2022-06-23_rcs_lab/rcs"
  "2023-04-11_quadream/kingspawn"
  "2023-06_01_operation_triangulation/operation_triangulation"
  "2023-07-25_wyrmspy_dragonegg/wyrmspy_dragonegg"
  "2024-12-25_eaglemsgspy/eaglemsgspy"
  "2026-03-03_coruna_cryptowaters/coruna"
  "2026-03-30_darksword/darksword"
  "2026-04-09_sio_spyrtacus/spyrtacus"
  "2026-04-23_ips_morpheus/morpheus"
  "2026-05-26_btmob/btmob"
  "ResidentBat/residentbat"
  "candiru/candiru"
  "cellebrite/cellebrite"
  "intellexa_predator/predator"
)

for p in "${PATHS[@]}"; do
  n="$(basename "$p")"
  echo "  unduh $n.stix2"
  curl -sSL --max-time 60 -o "$DIR/$n.stix2" "$MVT_BASE/$p.stix2"
done

echo "  unduh pegasus.stix2 (Amnesty, CC-BY)"
curl -sSL --max-time 60 -o "$DIR/pegasus.stix2" "$AMNESTY/2021-07-18_nso/pegasus.stix2"

echo "selesai. berkas di: $DIR"
