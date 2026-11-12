#!/usr/bin/env bash
#
# Mode demo cepat — untuk merekam video pendek.
#
# Masalah yang dipecahkan skrip ini: setelan bawaan TRINETRA sengaja realistis.
# Backend melatih baseline pada 4.000 event pertama tanpa menilai apa pun, dan
# rantai serangan muncul dengan peluang 5,5% per putaran. Itu benar untuk
# penggelaran, tetapi untuk rekaman 60 detik berarti layar masih kosong saat
# video berakhir.
#
# Mode ini HANYA memperpendek fase belajar dan memperbanyak frekuensi rantai.
# Yang TIDAK diubah: aturan deteksi, ambang risiko, bobot, dan logika korelasi.
# Jadi yang terlihat di video adalah deteksi yang sama, hanya dipercepat
# kedatangan datanya.
#
# Pakai:  ./scripts/demo-cepat.sh          (nyalakan mode cepat)
#         ./scripts/demo-cepat.sh normal   (kembalikan ke setelan realistis)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

MODE="${1:-cepat}"

if [ "$MODE" = "normal" ]; then
  echo "▸ mengembalikan setelan realistis…"
  unset WARMUP_EVENTS WARMUP_CONSUME CHAIN_RATE EVENTS_PER_SECOND
  docker compose up -d --force-recreate simulator backend
  echo "✓ kembali normal: warm-up 4000 event, CHAIN_RATE 0.055"
  exit 0
fi

echo "▸ menyalakan mode demo cepat…"
# warm-up 300 event pada 80 eps  ≈ 4 detik fase belajar (bukan ~100 detik)
# CHAIN_RATE 0.22                ≈ rantai pertama dalam ±5 detik
export WARMUP_EVENTS=300
export WARMUP_CONSUME=300
export CHAIN_RATE=0.22
export EVENTS_PER_SECOND=80

docker compose up -d --build

echo "▸ menunggu backend siap…"
for i in $(seq 1 60); do
  if curl -sf localhost:8000/health >/dev/null 2>&1; then break; fi
  sleep 2
done

echo "▸ menunggu warm-up selesai dan rantai pertama…"
for i in $(seq 1 90); do
  chains=$(curl -sf localhost:8000/stats 2>/dev/null \
    | python3 -c "import sys,json;print(json.load(sys.stdin).get('chains',0))" 2>/dev/null || echo 0)
  if [ "${chains:-0}" -gt 0 ]; then
    echo "✓ ${chains} rantai sudah terdeteksi — siap merekam"
    break
  fi
  sleep 2
done

echo
curl -sf localhost:8000/stats | python3 -m json.tool 2>/dev/null | head -20 || true
echo
cat <<'TIPS'
──────────────────────────────────────────────────────────────
SIAP MEREKAM

  Buka:  http://localhost:5173/?nointro#/console
         (?nointro melewati animasi boot 4,2 detik)

  Sembunyikan hal yang mengalihkan perhatian:
    • tab browser lain dan bookmark bar  (Cmd+Shift+B)
    • notifikasi macOS                   (Do Not Disturb)
    • perbesar ke 100%, jendela penuh    (Cmd+0, lalu Cmd+Ctrl+F)

  Rekam:  Cmd+Shift+5  →  "Record Selected Portion"  →  pilih jendela
          Matikan "Show Mouse Clicks" bila tidak perlu.

  Naskahnya ada di  VIDEO.md  (60 detik, 5 shot).
──────────────────────────────────────────────────────────────
TIPS
