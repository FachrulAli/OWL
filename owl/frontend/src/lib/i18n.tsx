import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Dua bahasa untuk satu sumber kebenaran.
 *
 * Teks antarmuka disimpan di berkas ini dalam dua bahasa. Teks yang datang
 * dari OWL Core, yaitu judul aturan, alasan keputusan, dan bukti temuan,
 * tetap dihasilkan backend dalam bahasa Indonesia; di sini hanya
 * diterjemahkan untuk ditampilkan. Jika satu teks backend belum punya
 * padanan, yang ditampilkan adalah teks aslinya, bukan ruang kosong.
 */
export type Lang = 'id' | 'en'

const KEY = 'owl.lang'

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'id' || saved === 'en') return saved
  } catch {
    // Penyimpanan browser dapat ditolak, misalnya pada jendela privat.
    // Bahasa bawaan tetap jalan tanpa itu.
  }
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'id'
}

const S = {
  'tab.gerbang': { id: 'Gerbang', en: 'Gate' },
  'tab.perangkat': { id: 'Perangkat', en: 'Devices' },
  'tab.aturan': { id: 'Aturan & bobot', en: 'Rules & weights' },
  'tab.soc': { id: 'SOC / CSIRT', en: 'SOC / CSIRT' },

  'land.toDashboard': { id: 'Dashboard', en: 'Dashboard' },
  'land.home': { id: 'Kembali ke halaman depan', en: 'Back to the landing page' },

  'top.logout': { id: 'Keluar', en: 'Log out' },
  'loader.line': {
    id: 'menyalakan mesin aturan',
    en: 'starting the rule engine',
  },

  'loader.unlock': {
    id: 'membuka dashboard',
    en: 'opening the dashboard',
  },

  'top.refresh': { id: 'Muat ulang', en: 'Reload' },
  'top.offline': { id: 'mode luring · rekaman', en: 'offline mode · recorded' },
  'top.airgapped': { id: 'on-prem · air-gapped', en: 'on-prem · air-gapped' },
  'top.langLabel': { id: 'Bahasa tampilan', en: 'Display language' },

  'offline.title': { id: 'Mode luring', en: 'Offline mode' },
  'offline.body': {
    id: 'OWL Core tidak terjangkau dari sini, jadi yang Anda lihat adalah rekaman '
      + 'penilaian dari mesin aturan yang sama, dibuat {time}, dan angkanya sendiri '
      + 'tidak dihitung di browser. Untuk menilai telemetri baru dan mengeluarkan event '
      + 'ke SOC, jalankan',
    en: 'OWL Core cannot be reached from here, so what you see is a recorded '
      + 'assessment produced by the same rule engine on {time}. None of these numbers '
      + 'are computed in the browser. To assess fresh telemetry and emit SOC events, run',
  },
  'offline.body2': {
    id: 'dari folder',
    en: 'from the',
  },
  'offline.body3': {
    id: 'lalu muat ulang halaman ini.',
    en: 'folder, then reload this page.',
  },

  'login.title': { id: 'Dashboard terkunci', en: 'Dashboard locked' },
  'login.body': {
    id: 'Masukkan kata sandi satuan untuk membuka penilaian perangkat.',
    en: 'Enter the unit password to open the device assessments.',
  },
  'login.close': {
    id: 'Tutup dan kembali ke halaman depan',
    en: 'Close and go back to the landing page',
  },
  'login.password': { id: 'Kata sandi', en: 'Password' },
  'login.open': { id: 'Buka', en: 'Unlock' },
  'login.checking': { id: 'Memeriksa…', en: 'Checking…' },
  'login.wrong': { id: 'Kata sandi salah.', en: 'Wrong password.' },
  'login.guest': { id: 'Masuk sebagai tamu', en: 'Continue as guest' },
  'login.guestNote': {
    id: 'Mode tamu memperoleh akses yang sama dengan admin. Pemisahan peran '
      + 'belum dipasang, jadi layar ini menahan tampilan, bukan membatasi hak.',
    en: 'Guest mode gets the same access as admin. Role separation is not in '
      + 'place yet, so this screen holds back the view rather than limiting rights.',
  },
  'login.guestUnavailable': {
    id: 'Mode tamu tidak tersedia pada penggelaran ini, sebab kunci bacanya '
      + 'sudah diganti. Masukkan kata sandi satuan.',
    en: 'Guest mode is not available on this deployment, because the read key has '
      + 'been changed. Enter the unit password.',
  },
  'login.offlineNote': {
    id: 'OWL Core tidak terjangkau dari sini, jadi kata sandi tidak dapat '
      + 'diperiksa di server dan layar ini hanya menahan tampilan rekaman.',
    en: 'OWL Core cannot be reached from here, so the password cannot be checked '
      + 'on the server and this screen only holds back the recorded view.',
  },

  'err.title': { id: 'Gagal memuat data', en: 'Could not load data' },

  'gate.kicker': { id: 'Gerbang Risiko Perangkat', en: 'Device Risk Gate' },
  'gate.emptyTitle': { id: 'Belum ada perangkat terdaftar', en: 'No devices enrolled yet' },
  'gate.emptyBody': {
    id: 'Muat dua perangkat contoh, satu bersih dan satu berisiko, lalu jalankan '
      + 'gerbangnya. Keduanya dinilai oleh mesin aturan yang sama dengan yang menilai '
      + 'telemetri dari agent sungguhan.',
    en: 'Load two sample devices, one clean and one at risk, then run the gate. Both '
      + 'are assessed by the same rule engine that assesses telemetry from a real agent.',
  },
  'gate.seed': { id: 'Muat dua perangkat contoh', en: 'Load two sample devices' },
  'gate.seeding': { id: 'Memuat…', en: 'Loading…' },
  'gate.threshold': {
    id: 'Pilih sumber daya yang hendak diakses, lalu jalankan gerbang. Ambang deny '
      + 'mengikuti kepekaan sumber daya: 70 untuk sistem terklasifikasi, 90 untuk '
      + 'jaringan biasa.',
    en: 'Pick the resource being accessed, then run the gate. The deny threshold '
      + 'follows how sensitive that resource is: 70 for classified systems, 90 for the '
      + 'standard network.',
  },
  'gate.note1': { id: 'Keluarannya adalah', en: 'The output is an' },
  'gate.noteBold': {
    id: 'rekomendasi keputusan akses',
    en: 'access decision recommendation',
  },
  'gate.note2': {
    id: '. Pemblokiran yang sebenarnya menuntut integrasi dengan gateway, IAM, atau MDM '
      + 'satuan, dan itu belum terpasang pada purwarupa ini.',
    en: '. Actual blocking requires integration with the unit gateway, IAM, or MDM, and '
      + 'that is not wired into this prototype yet.',
  },
  'gate.classified': { id: 'Sistem terklasifikasi', en: 'Classified system' },
  'gate.standard': { id: 'Jaringan biasa', en: 'Standard network' },
  'gate.run': { id: 'Jalankan gerbang', en: 'Run the gate' },
  'gate.running': { id: 'Menilai…', en: 'Assessing…' },
  'gate.pending': { id: 'BELUM DINILAI', en: 'NOT ASSESSED' },
  'gate.hint': {
    id: 'Tekan "Jalankan gerbang" untuk meminta keputusan dari Policy Decision Point.',
    en: 'Press "Run the gate" to request a decision from the Policy Decision Point.',
  },
  'gate.recommendation': { id: 'rekomendasi', en: 'recommendation' },
  'gate.quarantine': {
    id: 'perangkat dikarantina, eskalasi dikirim ke komando dan CSIRT',
    en: 'device quarantined, escalation sent to command and CSIRT',
  },
  'gate.attestationBad': { id: 'attestation agent tidak sah', en: 'agent attestation invalid' },
  'gate.skipped': {
    id: '{n} indikator tidak dapat diperiksa',
    en: '{n} indicators could not be checked',
  },
  'gate.checked': { id: 'diperiksa {time}', en: 'checked {time}' },
  'gate.neverChecked': { id: 'belum pernah diperiksa', en: 'never checked' },

  'dev.empty': { id: 'Belum ada perangkat terdaftar.', en: 'No devices enrolled yet.' },
  'dev.col.device': { id: 'Perangkat', en: 'Device' },
  'dev.col.unit': { id: 'Satuan', en: 'Unit' },
  'dev.col.role': { id: 'Peran', en: 'Role' },
  'dev.col.score': { id: 'Skor', en: 'Score' },
  'dev.col.level': { id: 'Tingkat', en: 'Level' },
  'dev.col.findings': { id: 'Temuan', en: 'Findings' },
  'dev.notAssessed': { id: 'belum dinilai', en: 'not assessed' },
  'dev.assessedAt': { id: 'dinilai {time}', en: 'assessed {time}' },
  'dev.indicatorStatus': {
    id: 'Status indikator pada pemeriksaan terakhir',
    en: 'Indicator status at the last check',
  },
  'dev.scoreBreakdown': { id: 'Rincian skor', en: 'Score breakdown' },
  'dev.mitre': { id: 'Pemetaan MITRE ATT&CK Mobile', en: 'MITRE ATT&CK Mobile mapping' },
  'dev.confidence': { id: 'keyakinan {v}', en: '{v} confidence' },

  'ind.noReport': {
    id: 'Agent tidak melaporkan status indikator, karena laporan ini datang dari versi '
      + 'agent sebelum status indikator ada. Seluruh indikatornya diperlakukan sebagai '
      + 'terbaca.',
    en: 'The agent reported no indicator status. This report comes from an agent build '
      + 'that predates indicator status, so every indicator is treated as readable.',
  },
  'ind.col.indicator': { id: 'Indikator', en: 'Indicator' },
  'ind.col.status': { id: 'Status', en: 'Status' },
  'ind.col.source': { id: 'Sumber', en: 'Source' },
  'ind.col.checkedAt': { id: 'Waktu periksa', en: 'Checked at' },
  'ind.skipped': {
    id: '{n} aturan tidak dijalankan karena indikatornya tidak terbaca: {list}. '
      + 'Aturan yang dilewati tidak dihitung lulus.',
    en: '{n} rules were not run because their indicator could not be read: {list}. '
      + 'A skipped rule is never counted as passed.',
  },

  'contrib.none': {
    id: 'Tidak ada temuan pada laporan terakhir.',
    en: 'No findings in the latest report.',
  },
  'contrib.downgraded': {
    id: 'diturunkan karena berdiri sendiri',
    en: 'downgraded, uncorroborated',
  },
  'contrib.more': { id: 'dan {n} temuan lain', en: 'and {n} more findings' },

  'rules.loading': { id: 'Memuat katalog…', en: 'Loading the catalog…' },
  'rules.weights': { id: 'Bobot kategori', en: 'Category weights' },
  'rules.severity': { id: 'Severitas', en: 'Severity' },
  'rules.saturation': {
    id: 'Satu kategori mencapai bobot penuhnya pada jumlah severitas {n}.',
    en: 'A category reaches its full weight at a severity sum of {n}.',
  },
  'rules.thresholds': { id: 'Ambang keputusan', en: 'Decision thresholds' },
  'rules.th1': { id: '0 sampai {n}: lolos', en: '0 to {n}: pass' },
  'rules.th2': { id: '{a} sampai {b}: lolos dengan MFA', en: '{a} to {b}: pass with MFA' },
  'rules.th3': {
    id: '{a} sampai {b}: akses terbatas, dan ditolak untuk sistem terklasifikasi',
    en: '{a} to {b}: limited access, and denied for classified systems',
  },
  'rules.th4': {
    id: '{n} ke atas: ditolak dan dikarantina untuk semua sumber daya',
    en: '{n} and above: denied and quarantined for every resource',
  },
  'rules.weightOf': { id: 'bobot {n}', en: 'weight {n}' },
  'rules.col.id': { id: 'Id', en: 'Id' },
  'rules.col.rule': { id: 'Aturan', en: 'Rule' },
  'rules.col.severity': { id: 'Severitas', en: 'Severity' },
  'rules.col.mitre': { id: 'MITRE', en: 'MITRE' },
  'rules.col.confidence': { id: 'Keyakinan', en: 'Confidence' },
  'rules.corroborate': {
    id: 'turun satu tingkat jika menyala sendirian',
    en: 'drops one level when it fires alone',
  },

  'soc.kicker': { id: 'Event ke Kartika CSIRT', en: 'Events to Kartika CSIRT' },
  'soc.note': {
    id: 'STIX 2.1 lewat webhook bertanda tangan HMAC, dan CEF lewat Syslog. Status '
      + '"tersimpan lokal" adalah keadaan normal pada mode air-gapped, karena event '
      + 'tetap disimpan untuk diambil petugas.',
    en: 'STIX 2.1 over an HMAC-signed webhook, and CEF over Syslog. The status "stored '
      + 'locally" is normal in air-gapped mode, because the event is kept for an '
      + 'operator to collect.',
  },
  'soc.col.time': { id: 'Waktu', en: 'Time' },
  'soc.col.device': { id: 'Perangkat', en: 'Device' },
  'soc.col.kind': { id: 'Jenis', en: 'Kind' },
  'soc.col.status': { id: 'Status', en: 'Status' },
  'soc.delivered': { id: 'terkirim', en: 'delivered' },
  'soc.stored': { id: 'tersimpan lokal', en: 'stored locally' },
  'soc.empty': {
    id: 'Belum ada event. Jalankan gerbang lebih dahulu.',
    en: 'No events yet. Run the gate first.',
  },
  'soc.payload': { id: 'Payload', en: 'Payload' },
  'soc.pickEvent': {
    id: 'Pilih satu event untuk melihat payload yang dikirim.',
    en: 'Pick an event to see the payload that was sent.',
  },

  /* ——— ikhtisar satuan ——— */

  'tab.ikhtisar': { id: 'Ikhtisar', en: 'Overview' },
  'ov.empty': {
    id: 'Belum ada perangkat terdaftar, jadi belum ada yang dapat diikhtisarkan.',
    en: 'No devices are enrolled yet, so there is nothing to summarise.',
  },
  'ov.posture': { id: 'Postur satuan', en: 'Unit posture' },
  'ov.postureNote': {
    id: 'rata-rata skor dari {n} perangkat yang sudah dinilai',
    en: 'mean score across {n} assessed devices',
  },
  'ov.devices': { id: 'Perangkat terdaftar', en: 'Enrolled devices' },
  'ov.devicesNote': { id: '{n} belum pernah dinilai', en: '{n} never assessed' },
  'ov.atRisk': { id: 'Perlu tindakan', en: 'Needs action' },
  'ov.atRiskNote': {
    id: 'perangkat pada tingkat tinggi atau kritis',
    en: 'devices at high or critical level',
  },
  'ov.findings': { id: 'Temuan aktif', en: 'Active findings' },
  'ov.findingsNote': {
    id: '{n} di antaranya severitas tinggi atau kritis',
    en: '{n} of them high or critical severity',
  },
  'ov.blind': { id: 'Indikator tak terbaca', en: 'Unreadable indicators' },
  'ov.blindNote': {
    id: 'aturan yang dilewati, dan tidak dihitung lulus',
    en: 'rules skipped, and never counted as passed',
  },
  'ov.spread': { id: 'Sebaran tingkat risiko', en: 'Risk level spread' },
  'ov.spreadNote': {
    id: 'Tingkatnya keluar dari mesin aturan, memakai ambang yang sama dengan '
      + 'gerbang. Tidak ada ambang baru yang dibuat di layar ini.',
    en: 'Levels come from the rule engine, using the same thresholds as the gate. '
      + 'No new threshold is invented on this screen.',
  },
  'ov.byCategory': { id: 'Asal poin risiko', en: 'Where the risk points come from' },
  'ov.byCategoryNote': {
    id: 'Jumlah poin tiap kategori di seluruh perangkat. Kategori teratas adalah '
      + 'tempat perbaikan kebijakan paling berdampak.',
    en: 'Total points per category across every device. The top category is where a '
      + 'policy fix pays off most.',
  },
  'ov.noFindings': { id: 'Tidak ada temuan pada seluruh perangkat.', en: 'No findings on any device.' },
  'ov.attestation': {
    id: '{n} perangkat melapor dengan attestation agent yang tidak sah; laporannya '
      + 'tidak dipercaya.',
    en: '{n} devices reported with invalid agent attestation; their reports are not trusted.',
  },
  'ov.socFlow': { id: 'Keluaran terakhir ke SOC', en: 'Latest output to SOC' },
  'ov.socNote': {
    id: '"Tersimpan lokal" adalah keadaan normal pada mode air-gapped: event tetap '
      + 'disimpan untuk diambil petugas.',
    en: '"Stored locally" is normal in air-gapped mode: the event is kept for an '
      + 'operator to collect.',
  },

  /* ——— pencarian dan penyaringan perangkat ——— */

  'dev.search': { id: 'Cari perangkat', en: 'Search devices' },
  'dev.searchHint': {
    id: 'Cari nama, id, satuan, model, atau id aturan…',
    en: 'Search name, id, unit, model, or rule id…',
  },
  'dev.clear': { id: 'Kosongkan pencarian', en: 'Clear the search' },
  'dev.filterLevel': { id: 'Saring menurut tingkat risiko', en: 'Filter by risk level' },
  'dev.all': { id: 'Semua', en: 'All' },
  'dev.sort': { id: 'Urutkan', en: 'Sort' },
  'dev.sortScore': { id: 'Skor tertinggi dulu', en: 'Highest score first' },
  'dev.sortFindings': { id: 'Temuan terbanyak dulu', en: 'Most findings first' },
  'dev.sortName': { id: 'Nama A–Z', en: 'Name A–Z' },
  'dev.showing': {
    id: 'Menampilkan {n} dari {total} perangkat.',
    en: 'Showing {n} of {total} devices.',
  },
  'dev.reset': { id: 'Tampilkan semua', en: 'Show all' },
  'dev.noMatch': {
    id: 'Tidak ada perangkat yang cocok dengan pencarian itu.',
    en: 'No device matches that search.',
  },

  /* ——— panel aturan ——— */

  'panel.open': { id: 'Buka panel aturan dan bobot', en: 'Open the rules and weights panel' },
  'panel.close': { id: 'Tutup panel', en: 'Close the panel' },
  'panel.kicker': { id: 'Rujukan terbuka', en: 'Open reference' },
  'panel.lead': {
    id: 'Seluruh aturan beserta bobot, severitas, dan tingkat keyakinannya. Skor '
      + 'yang tidak dapat dibuka adalah skor yang tidak dapat dipercaya, jadi '
      + 'halaman ini sengaja dapat dibuka kapan saja tanpa meninggalkan layar kerja.',
    en: 'Every rule with its weight, severity, and confidence. A score you cannot '
      + 'open is a score you cannot trust, so this reference stays reachable without '
      + 'leaving the screen you are working on.',
  },

  /* ——— versi build ——— */

  'ver.title': { id: 'Keterangan build', en: 'Build information' },
  'ver.build': { id: 'Versi', en: 'Version' },
  'ver.mode': { id: 'Mode', en: 'Mode' },
  'ver.recorded': { id: 'Rekaman dibuat', en: 'Recording made' },
  'ver.note': {
    id: 'Versi mesin aturan yang menilai, bukan versi tampilan. Keduanya dibangun '
      + 'dan diterbitkan bersama.',
    en: 'The version of the rule engine doing the assessment, not of the interface. '
      + 'Both are built and shipped together.',
  },
  'top.online': { id: 'mode daring · langsung', en: 'online mode · live' },

  /* ——— peta gelaran ——— */

  'map.kicker': { id: 'Gelaran satuan', en: 'Unit deployment' },
  'map.note': {
    id: 'Cakupan komando tempat OWL digelar. Peta ini menunjukkan WILAYAH, bukan '
      + 'posisi perangkat: OWL tidak pernah membaca lokasi perangkat, dan skema '
      + 'telemetrinya tidak punya tempat untuk itu.',
    en: 'The command footprint OWL is deployed across. This map shows TERRITORY, not '
      + 'device positions: OWL never reads a device location, and its telemetry schema '
      + 'has no field for one.',
  },
  'map.kodam': { id: 'Kodam', en: 'Area commands' },
  'map.mapped': { id: 'perangkat terpetakan', en: 'devices mapped' },
  'map.alt': {
    id: 'Peta Indonesia dengan pin markas Kodam',
    en: 'Map of Indonesia with area command headquarters pins',
  },
  'map.close': { id: 'Tutup keterangan', en: 'Close the details' },
  'map.center': { id: 'Markas besar', en: 'Headquarters' },
  'map.command': { id: 'Komando daerah militer', en: 'Military area command' },
  'map.new': { id: 'baru', en: 'new' },
  'map.new2025': { id: 'penataan 2025', en: '2025 expansion' },
  'map.lit': { id: 'wilayah berdata', en: 'territory with data' },
  'map.hq': { id: 'Markas', en: 'Based at' },
  'map.area': { id: 'Wilayah', en: 'Territory' },
  'map.devices': { id: 'Perangkat', en: 'Devices' },
  'map.deviceN': { id: '{n} terdaftar', en: '{n} enrolled' },
  'map.deviceNone': { id: 'belum ada yang terdaftar', en: 'none enrolled yet' },
  /* ——— lonceng pemberitahuan ——— */

  'notif.title': { id: 'Pemberitahuan', en: 'Notifications' },
  'notif.open': { id: 'Buka pemberitahuan', en: 'Open notifications' },
  'notif.openN': {
    id: 'Buka pemberitahuan, {n} belum dibaca',
    en: 'Open notifications, {n} unread',
  },
  'notif.empty': {
    id: 'Tidak ada yang perlu diperhatikan. OWL Core terjangkau dan data di layar '
      + 'ini hasil penilaian baru.',
    en: 'Nothing needs attention. OWL Core is reachable and what is on screen is a '
      + 'fresh assessment.',
  },

  /* ——— kendali peta ——— */

  'map.zoomIn': { id: 'Perbesar peta', en: 'Zoom in' },
  'map.zoomOut': { id: 'Perkecil peta', en: 'Zoom out' },
  'map.reset': { id: 'Kembalikan pandangan peta', en: 'Reset the view' },
  'map.hide': { id: 'Sembunyikan panel', en: 'Hide the panel' },
  'map.show': { id: 'Tampilkan panel', en: 'Show the panel' },
  'map.dragHint': {
    id: 'seret untuk menggeser · cubit untuk zoom · ketuk ganda untuk mendekat',
    en: 'drag to pan · pinch to zoom · double-click to zoom in',
  },
  'map.zoomHint': {
    id: 'Cubit touchpad, atau tahan Ctrl / ⌘ sambil menggulung, untuk mengubah zoom peta.',
    en: 'Pinch the touchpad, or hold Ctrl / ⌘ while scrolling, to zoom the map.',
  },
  'map.unmapped': {
    id: '{n} di antaranya belum dipetakan ke Kodam mana pun, dan dikumpulkan di '
      + 'markas besar sampai kolom satuannya diisi. Perangkat terdaftar yang tidak '
      + 'muncul di mana-mana lebih berbahaya daripada perangkat yang ditaruh di '
      + 'sini sambil dinyatakan belum terpetakan.',
    en: '{n} of these are not mapped to any area command yet, and are gathered at '
      + 'headquarters until their unit field is filled in. An enrolled device that '
      + 'appears nowhere is more dangerous than one parked here and openly marked '
      + 'as unmapped.',
  },

  'gate.results': { id: 'Jawaban gerbang', en: 'Gate answers' },
  'gate.decisive': { id: 'aturan penentu', en: 'decisive rule' },
  'gate.decisiveNote': {
    id: 'Aturan penentu: menyala pada severitas critical berarti gerbang menolak '
      + 'tanpa menimbang skor. Dipakai untuk kecocokan yang pasti, bukan indikasi.',
    en: 'Decisive rule: firing at critical severity denies at the gate without the '
      + 'score being weighed at all. Used for exact matches, not indications.',
  },
  'dev.revoked': { id: 'dicabut', en: 'revoked' },

  /* ——— operasi perangkat ——— */

  'tab.operasi': { id: 'Operasi', en: 'Operations' },
  'ops.kicker': { id: 'Operasi perangkat', en: 'Device operations' },
  'ops.offlineTitle': {
    id: 'Operasi menuntut OWL Core yang berjalan',
    en: 'Operations needs a running OWL Core',
  },
  'ops.offlineBody': {
    id: 'Pencabutan perangkat, penanganan kasus, dan daftar pencabutan attestation '
      + 'adalah keadaan yang berubah dan ditindaklanjuti petugas. Halaman ini sengaja '
      + 'TIDAK punya rekaman cadangan: menampilkan rekaman lama sebagai keadaan '
      + 'sekarang berarti menyuruh orang bertindak atas dunia yang sudah lewat. '
      + 'Jalankan OWL Core, lalu buka halaman ini lagi.',
    en: 'Device revocation, case handling, and the attestation revocation list are '
      + 'live state that operators act on. This page deliberately has NO recorded '
      + 'fallback: showing an old recording as the present state means telling people '
      + 'to act on a world that has moved on. Start OWL Core, then open this page again.',
  },
  'ops.adminKey': { id: 'Kunci admin', en: 'Admin key' },
  'ops.adminHint': { id: 'X-OWL-Admin', en: 'X-OWL-Admin' },
  'ops.adminNote': {
    id: 'Disimpan di memori halaman ini saja, tidak di penyimpanan browser. Kunci '
      + 'baca hanya membuka tampilan; kunci ini mengubah kebijakan, dan kunci semacam '
      + 'itu tidak pantas bertahan melewati satu kali muat halaman.',
    en: 'Held in this page’s memory only, never in browser storage. The read key only '
      + 'opens the view; this one changes policy, and a key like that has no business '
      + 'surviving a page load.',
  },

  'ops.revList': { id: 'Daftar pencabutan attestation', en: 'Attestation revocation list' },
  'ops.revEntries': { id: 'entri', en: 'entries' },
  'ops.revAge': { id: 'hari umur', en: 'days old' },
  'ops.revFresh': { id: 'terkini', en: 'current' },
  'ops.revStale': { id: 'basi', en: 'stale' },
  'ops.revMissing': { id: 'belum diimpor', en: 'not imported' },
  'ops.revNote': {
    id: 'Berkas status Google, diunduh di mesin terhubung lalu dibawa lewat media. '
      + 'OWL Core tidak pernah mengunduhnya sendiri, dan itu syarat air-gapped, bukan '
      + 'keterbatasan yang belum sempat diperbaiki.',
    en: 'Google’s status file, downloaded on a connected machine and carried in on '
      + 'media. OWL Core never fetches it itself; that is an air-gap requirement, not '
      + 'a limitation left unfinished.',
  },
  'ops.revImport': { id: 'Impor berkas pencabutan (JSON)', en: 'Import revocation file (JSON)' },

  'ops.lists': { id: 'Daftar larangan dan pengecualian', en: 'Blocklist and allowlist' },
  'ops.listsNote': {
    id: 'Daftar larangan menyalakan OWL-A03, satu-satunya aturan penentu di kategori '
      + 'aplikasi. Pengecualian pabrik membebaskan paket bawaan satuan dari OWL-A01.',
    en: 'The blocklist drives OWL-A03, the only decisive rule in the application '
      + 'category. The factory allowlist exempts unit-installed packages from OWL-A01.',
  },
  'ops.blocklist': { id: 'Ganti daftar larangan (bundle STIX)', en: 'Replace blocklist (STIX bundle)' },
  'ops.factory': { id: 'Ganti pengecualian pabrik (JSON)', en: 'Replace factory allowlist (JSON)' },
  'ops.scan': { id: 'Jalankan pemeriksaan alarm', en: 'Run the alarm sweep' },
  'ops.scanNote': {
    id: 'Memeriksa perangkat yang berhenti melapor, sesi akses kedaluwarsa, dan '
      + 'lonjakan penolakan. Berjalan sendiri tiap menit; tombol ini hanya '
      + 'mendahuluinya.',
    en: 'Checks for devices that stopped reporting, expired access sessions, and '
      + 'rejection spikes. It runs by itself every minute; this button only gets ahead of it.',
  },
  'ops.scanned': { id: 'Pemeriksaan alarm dijalankan.', en: 'Alarm sweep run.' },

  'ops.device': { id: 'Satu perangkat', en: 'One device' },
  'ops.deviceId': { id: 'ID perangkat', en: 'Device id' },
  'ops.devicePick': { id: 'ketik atau pilih dari daftar', en: 'type or pick from the list' },
  'ops.note': { id: 'Alasan atau catatan', en: 'Reason or note' },
  'ops.noteHint': {
    id: 'tercatat di jejak audit, minimal 3 huruf',
    en: 'recorded in the audit trail, at least 3 characters',
  },
  'ops.token': { id: 'Terbitkan token pendaftaran', en: 'Issue enrolment token' },
  'ops.apk': { id: 'Unduh untuk Android', en: 'Download for Android' },
  'ops.apkIos': { id: 'Unduh untuk iOS', en: 'Download for iOS' },
  'ops.soon': { id: 'segera hadir', en: 'coming soon' },
  'ops.apkSoon': {
    id: 'Tautan unduhnya belum dipasang. APK rilisnya sedang disiapkan.',
    en: 'The download link is not wired up yet. The release APK is being prepared.',
  },
  'ops.iosWhy': {
    id: 'Enam sinyal OWL dibaca lewat API yang tertutup bagi aplikasi pihak ketiga '
      + 'di iOS: daftar aplikasi terpasang, sumber pemasangan, layanan aksesibilitas, '
      + 'dan sertifikat CA pengguna.',
    en: 'OWL’s six signals are read through APIs that iOS closes to third-party apps: '
      + 'the installed app list, install source, accessibility services, and '
      + 'user-installed CA certificates.',
  },
  'ops.tokenIssued': { id: 'Token pendaftaran diterbitkan.', en: 'Enrolment token issued.' },
  'ops.revoke': { id: 'Cabut perangkat', en: 'Revoke device' },
  'ops.revokeDone': { id: 'Perangkat dicabut.', en: 'Device revoked.' },
  'ops.unrevoke': { id: 'Buka pencabutan', en: 'Lift revocation' },
  'ops.unrevokeDone': { id: 'Pencabutan dibuka.', en: 'Revocation lifted.' },
  'ops.revoked': { id: 'dicabut', en: 'revoked' },
  'ops.linkOnce': { id: 'Tautan sekali pakai', en: 'One-time link' },
  'ops.linkNote': {
    id: 'Hanya muncul sekali; yang tersimpan di server cuma sidiknya. Buka di '
      + 'perangkat yang hendak didaftarkan, atau salin ke saluran yang aman.',
    en: 'Shown once only; the server keeps nothing but its fingerprint. Open it on the '
      + 'device being enrolled, or copy it into a safe channel.',
  },

  'ops.caseEdit': { id: 'Penanganan perangkat ini', en: 'Handling for this device' },
  'ops.caseStatus': { id: 'Status', en: 'Status' },
  'ops.caseTtl': { id: 'Masa pengecualian (menit)', en: 'Exception window (minutes)' },
  'ops.caseSave': { id: 'Simpan penanganan', en: 'Save handling' },
  'ops.caseSaved': { id: 'Penanganan tersimpan.', en: 'Handling saved.' },
  'ops.st.baru': { id: 'baru', en: 'new' },
  'ops.st.diperiksa': { id: 'diperiksa', en: 'under review' },
  'ops.st.diselesaikan': { id: 'diselesaikan', en: 'resolved' },
  'ops.st.dikecualikan': { id: 'dikecualikan', en: 'excepted' },
  'ops.exceptionWarn': {
    id: 'Pengecualian hanya menutup SKOR, dan hanya sampai waktunya habis. Ia tidak '
      + 'dapat meloloskan perangkat yang dicabut, laporan yang kedaluwarsa, '
      + 'attestation yang gagal, atau aturan penentu yang menyala.',
    en: 'An exception overrides the SCORE only, and only until it expires. It cannot '
      + 'let through a revoked device, a stale report, failed attestation, or a '
      + 'decisive rule that has fired.',
  },
  'ops.cases': { id: 'Penanganan berjalan', en: 'Open handling' },
  'ops.casesEmpty': {
    id: 'Belum ada penanganan. Baris dibuat sendiri ketika gerbang mengarantina '
      + 'sebuah perangkat.',
    en: 'No handling yet. A row appears by itself when the gate quarantines a device.',
  },
  'ops.actor': { id: 'Pelaku', en: 'Actor' },
  'ops.expires': { id: 'Kedaluwarsa', en: 'Expires' },
  'ops.imported': { id: '{nama} diimpor.', en: '{nama} imported.' },
  'ops.badJson': { id: '{nama} bukan JSON yang sah.', en: '{nama} is not valid JSON.' },

  /* ——— metrik gerbang pada ikhtisar ——— */

  'ov.mix': { id: 'Keputusan gerbang saat ini', en: 'Gate decisions right now' },
  'ov.mixNote': {
    id: 'Dihitung ulang backend atas telemetri terakhir tiap perangkat memakai '
      + 'kebijakan yang berlaku sekarang, bukan keputusan yang tersimpan dari dulu.',
    en: 'Recomputed by the backend over each device’s latest telemetry using the '
      + 'policy in force now, not decisions stored from some earlier run.',
  },
  'ov.rejects': { id: 'Telemetri ditolak', en: 'Rejected telemetry' },
  'ov.rejectsNone': {
    id: 'Tidak ada laporan yang ditolak.',
    en: 'No report has been rejected.',
  },
  'ov.revUnchecked': {
    id: '{n} perangkat belum dapat diperiksa terhadap daftar pencabutan.',
    en: '{n} devices cannot be checked against the revocation list yet.',
  },
  'ov.stale': { id: 'Laporan kedaluwarsa', en: 'Stale reports' },
  'ov.staleNote': {
    id: 'perangkat yang penilaian terakhirnya melewati ambang umur, dan karena itu '
      + 'ditolak gerbang tanpa melihat skor',
    en: 'devices whose last assessment is past the age threshold, and are therefore '
      + 'denied at the gate without the score being looked at',
  },

  'map.detail': { id: 'Keterangan satuan', en: 'Command details' },
  'map.withDevices': {
    id: 'Satuan yang sudah punya perangkat',
    en: 'Commands with devices enrolled',
  },
  'map.pick': {
    id: 'Tekan satu pin untuk membuka keterangan satuan beserta perangkat yang '
      + 'terdaftar di bawahnya.',
    en: 'Press a pin to open that command’s details and the devices enrolled under it.',
  },
  'map.deviceList': { id: 'Perangkat terdaftar · {n}', en: 'Enrolled devices · {n}' },
  'map.deviceNoneLong': {
    id: 'Belum ada perangkat yang terdaftar pada satuan ini. Perangkat masuk ke '
      + 'daftar ini ketika kolom satuan pada registrasinya menyebut satuan ini.',
    en: 'No device is enrolled under this command yet. A device joins this list when '
      + 'the unit field on its enrolment names this command.',
  },
} as const

export type Key = keyof typeof S

/** Nama kategori aturan. */
const CATEGORY = {
  runtime: { id: 'Perilaku runtime', en: 'Runtime behaviour' },
  app: { id: 'Integritas aplikasi', en: 'Application integrity' },
  config: { id: 'Konfigurasi', en: 'Configuration' },
  device: { id: 'Integritas perangkat', en: 'Device integrity' },
  identity: { id: 'Perilaku jaringan', en: 'Network behaviour' },
} as const

/** Nama keputusan. Padanan resminya ada di Requirements §3.3. */
const DECISION = {
  allow: { id: 'LOLOS', en: 'ALLOW' },
  step_up: { id: 'LOLOS + MFA', en: 'ALLOW + MFA' },
  limited: { id: 'TERBATAS', en: 'RESTRICTED' },
  deny: { id: 'DITOLAK', en: 'DENIED' },
} as const

/** Istilah Requirements §3.3, sengaja tetap bahasa Inggris pada kedua bahasa. */
export const DECISION_EN: Record<string, string> = {
  allow: 'Allow',
  step_up: 'Step-up',
  limited: 'Restrict',
  deny: 'Deny / Quarantine',
}

/** Nama indikator pada laporan agent, untuk tabel status (FR-02, FR-03). */
const INDICATOR = {
  permissions: { id: '1. Izin aplikasi', en: '1. Application permissions' },
  accessibility: {
    id: '2. Layanan aksesibilitas dan hamparan',
    en: '2. Accessibility services and overlays',
  },
  certificates: { id: '3a. Sertifikat CA pengguna', en: '3a. User-installed CA certificates' },
  vpn: { id: '3b. Profil VPN', en: '3b. VPN profiles' },
  install_source: { id: '4. Sumber pemasangan aplikasi', en: '4. App install source' },
  integrity: { id: '5. Integritas perangkat dan patch', en: '5. Device integrity and patch level' },
  network_volume: {
    id: '6a. Volume unggahan dan waktu layar menyala',
    en: '6a. Egress volume and screen-on time',
  },
  network_destinations: { id: '6b. Tujuan jaringan', en: '6b. Network destinations' },
  attestation: { id: 'Attestation agent', en: 'Agent attestation' },
} as const

/**
 * Status keterbacaan indikator.
 *
 * `Unavailable` dan `Not Supported` sengaja tetap berbahasa Inggris pada
 * kedua bahasa, karena Requirements FR-03 menyebut kedua kata itu sebagai
 * status yang harus muncul di layar.
 */
const AVAILABILITY = {
  ok: { id: 'Terbaca', en: 'Readable' },
  partial: { id: 'Sebagian', en: 'Partial' },
  unavailable: { id: 'Unavailable', en: 'Unavailable' },
  not_supported: { id: 'Not Supported', en: 'Not Supported' },
} as const

/** Tingkat risiko dan tingkat keyakinan, dikirim backend dalam bahasa Indonesia. */
const WORD: Record<string, string> = {
  rendah: 'low',
  sedang: 'medium',
  tinggi: 'high',
  kritis: 'critical',
  agent: 'agent',
  resolver: 'resolver',
}

/** Judul dan uraian aturan, berpasangan dengan `rules/rules.yaml`. */
const RULE_EN: Record<string, { title: string; detail: string }> = {
  'OWL-R01': {
    title: 'Accessibility service outside the allowlist',
    detail: 'An app holds BIND_ACCESSIBILITY_SERVICE without being on the unit '
      + 'allowlist. That permission reads the entire screen and can press buttons on '
      + 'the user’s behalf, and it is the primary route for credential theft.',
  },
  'OWL-R02': {
    title: 'Overlay window on top of other apps',
    detail: 'An app holds SYSTEM_ALERT_WINDOW. Several apps use it legitimately, so on '
      + 'its own it is not enough; together with OWL-R01 the pattern is a '
      + 'credential-stealing overlay.',
  },
  'OWL-A01': {
    title: 'App installed from outside the official store',
    detail: 'The installing source is not a permitted store. Installed by hand from an '
      + 'APK file counts as high; a source that was not recorded at all (factory '
      + 'preload or adb, indistinguishable from here) counts as medium.',
  },
  'OWL-A02': {
    title: 'App from outside the official store holds recording permissions',
    detail: 'An app whose source is not a permitted store holds a combination of '
      + 'microphone, camera, or location permissions. The correlation is per app: a '
      + 'store app holding the same permissions, a messenger for instance, is not '
      + 'counted, because that fires on nearly every phone and distinguishes nothing.',
  },
  'OWL-A03': {
    title: 'App on the blocklist',
    detail: 'The package name or signer fingerprint matches the unit blocklist. This '
      + 'is an exact match rather than an indication, so the gate denies without '
      + 'weighing the score. Package names are easy for an attacker to change; a '
      + 'signer match is stronger and is used whenever the agent reports one.',
  },
  'OWL-C01': {
    title: 'CA certificate installed by the user',
    detail: 'There is a CA in the user trust store. On an official device there is no '
      + 'legitimate reason for that, and such a CA is a precondition for TLS interception.',
  },
  'OWL-C02': {
    title: 'VPN profile outside the allowlist',
    detail: 'An active VPN that does not belong to the unit redirects all device '
      + 'traffic to an unknown party.',
  },
  'OWL-D01': {
    title: 'Device integrity failed',
    detail: 'Play Integrity rejects the device, or root artefacts (su, Magisk) were '
      + 'found, or the bootloader is unlocked. Root voids nearly every security '
      + 'assumption the other checks rely on.',
  },
  'OWL-D02': {
    title: 'Security patch behind',
    detail: 'The security patch level is older than the unit threshold. It rises to '
      + 'high once it passes the second threshold.',
  },
  'OWL-N01': {
    title: 'Large upload while the device was idle',
    detail: 'Egress volume over 24 hours passes the threshold while the screen stayed '
      + 'off. Metadata only; traffic content is never read.',
  },
  'OWL-N02': {
    title: 'Unusual network destination or regular beacon pattern',
    detail: 'Destinations outside those a unit device usually contacts, or egress '
      + 'intervals too regular for human traffic.',
  },
  'OWL-N03': {
    title: 'New network destination outside the device’s habit',
    detail: 'The device contacted a destination never seen in its own history. On its '
      + 'own this proves nothing, because ordinary use produces new destinations too. '
      + 'Recorded as a weak signal so an analyst sees it when other signals fire as well.',
  },
  'OWL-X01': {
    title: 'Agent attestation invalid',
    detail: 'The report comes from an agent that cannot prove it is a genuine build in '
      + 'a hardware-backed Keystore. A “clean device” report from an '
      + 'unverified agent means nothing. It drops to medium when the key is proven but '
      + 'the Play Integrity verdict cannot be obtained, and disappears entirely in '
      + 'air-gapped mode, where that verdict is impossible to fetch and Key Attestation '
      + 'is its legitimate replacement.',
  },
}

/** Alasan keputusan dari Policy Decision Point, dicocokkan pada awalannya. */
const REASON_EN: [string, string][] = [
  ['Attestation agent tidak sah',
    'Agent attestation is invalid. This device’s report is not trusted.'],
  ['Allow.', 'Allow. Score is below the threshold; full access is recommended.'],
  ['Step-up.',
    'Step-up. Score is moderate; access is recommended after additional verification (MFA).'],
  ['Restrict.',
    'Restrict. Score is high; access to sensitive resources is recommended to be limited.'],
  ['Deny / Quarantine. Perangkat dicabut administrator',
    'Deny / Quarantine. The device was revoked by an administrator.'],
  ['Deny / Quarantine. Aturan penentu menyala',
    'Deny / Quarantine. A decisive rule fired, so the score was not weighed at all.'],
  ['Laporan kedaluwarsa.',
    'Report expired. The last assessment is older than the threshold, so the current '
    + 'state of the device is unknown; access is recommended to be denied until the '
    + 'agent reports again.'],
  ['Pengecualian admin sampai',
    'Admin exception in force. The score is overridden until the stated time; it '
    + 'cannot override revocation, a stale report, failed attestation, or a decisive rule.'],
  ['Deny / Quarantine.',
    'Deny / Quarantine. Score passes the threshold for this resource; access is '
    + 'recommended to be denied and the device quarantined.'],
]

/** Bukti temuan, dirakit backend dari pola tetap. */
const EVIDENCE_EN: [RegExp, string][] = [
  [/^layanan aksesibilitas aktif: /, 'accessibility service active: '],
  [/^SYSTEM_ALERT_WINDOW: /, 'SYSTEM_ALERT_WINDOW: '],
  [/^CA pengguna: /, 'user-installed CA: '],
  [/^profil VPN aktif: /, 'active VPN profile: '],
  [/^tujuan tidak lazim: /, 'unusual destinations: '],
  [/^tujuan baru: /, 'new destination: '],
  [/^artefak root: /, 'root artefacts: '],
  [/^tingkat patch tidak terbaca: /, 'patch level unreadable: '],
  [/^verdict Play Integrity tidak diperoleh: /, 'Play Integrity verdict unavailable: '],
  [/^verdict Play Integrity: /, 'Play Integrity verdict: '],
  [/^bootloader terbuka$/, 'bootloader unlocked'],
  [/^Play Integrity: FAILED$/, 'Play Integrity: FAILED'],
]

function translateEvidence(raw: string): string {
  for (const [re, en] of EVIDENCE_EN) {
    if (re.test(raw)) return raw.replace(re, en)
  }
  let m = raw.match(/^(.+) dipasang oleh (.+)$/)
  if (m) return `${m[1]} installed by ${m[2] === 'sumber tidak diketahui' ? 'an unknown source' : m[2]}`
  m = raw.match(/^patch (.+), tertinggal (\d+) hari$/)
  if (m) return `patch ${m[1]}, ${m[2]} days behind`
  m = raw.match(/^unggahan (.+) MB dalam 24 jam$/)
  if (m) return `${m[1]} MB uploaded in 24 hours`
  m = raw.match(/^layar menyala (.+) persen dari waktu itu$/)
  if (m) return `screen on for ${m[1]} percent of that window`
  m = raw.match(/^interval keluar terlalu teratur \(jitter (.+) persen\)$/)
  if (m) return `egress interval too regular (jitter ${m[1]} percent)`
  m = raw.match(/^kunci agent tidak terikat perangkat keras/)
  if (m) return 'agent key is not hardware-backed'
  return raw
}

/** Alasan status indikator, dikirim agent dalam bahasa Indonesia. */
const REASON_INDICATOR_EN: [string, string][] = [
  ['status bootloader tidak diberikan API publik; dinilai lewat verdict integritas',
    'bootloader status is not exposed by any public API; judged through the integrity verdict'],
]

interface Ctx {
  lang: Lang
  setLang: (l: Lang) => void
}

const LangCtx = createContext<Ctx>({ lang: 'id', setLang: () => undefined })

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(KEY, l) } catch { /* lihat initialLang */ }
  }, [])

  useEffect(() => { document.documentElement.lang = lang }, [lang])

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang])
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>
}

export interface Translator {
  lang: Lang
  setLang: (l: Lang) => void
  /** Teks antarmuka. Nilai `{nama}` diganti dari `vars`. */
  t: (key: Key, vars?: Record<string, string | number>) => string
  /** Tanggal dan waktu mengikuti bahasa yang sedang dipakai. */
  locale: string
  category: (c: string) => string
  decision: (d: string) => string
  indicator: (k: string) => string
  availability: (s: string) => string
  /** Tingkat risiko, keyakinan, dan sumber indikator. */
  word: (w: string) => string
  ruleTitle: (id: string, fallback: string) => string
  ruleDetail: (id: string, fallback: string) => string
  reason: (raw: string) => string
  evidence: (raw: string) => string
  indicatorReason: (raw: string) => string
}

export function useT(): Translator {
  const { lang, setLang } = useContext(LangCtx)

  return useMemo<Translator>(() => {
    const pick = (pair: { id: string; en: string } | undefined, fallback: string) =>
      pair ? pair[lang] : fallback

    return {
      lang,
      setLang,
      locale: lang === 'id' ? 'id-ID' : 'en-GB',
      t: (key, vars) => {
        let out: string = S[key][lang]
        if (vars) {
          for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v))
        }
        return out
      },
      category: (c) => pick(CATEGORY[c as keyof typeof CATEGORY], c),
      decision: (d) => pick(DECISION[d as keyof typeof DECISION], d),
      indicator: (k) => pick(INDICATOR[k as keyof typeof INDICATOR], k),
      availability: (s) => pick(AVAILABILITY[s as keyof typeof AVAILABILITY], s),
      word: (w) => (lang === 'id' ? w : WORD[w] ?? w),
      ruleTitle: (id, fallback) => (lang === 'id' ? fallback : RULE_EN[id]?.title ?? fallback),
      ruleDetail: (id, fallback) => (lang === 'id' ? fallback : RULE_EN[id]?.detail ?? fallback),
      reason: (raw) => {
        if (lang === 'id') return raw
        for (const [prefix, en] of REASON_EN) if (raw.startsWith(prefix)) return en
        return raw
      },
      evidence: (raw) => (lang === 'id' ? raw : translateEvidence(raw)),
      indicatorReason: (raw) => {
        if (lang === 'id') return raw
        for (const [src, en] of REASON_INDICATOR_EN) if (raw === src) return en
        return raw
      },
    }
  }, [lang, setLang])
}

/** Tombol bahasa di pojok bilah atas. */
export function LangToggle() {
  const { lang, setLang, t } = useT()
  return (
    <div className="langswitch" role="group" aria-label={t('top.langLabel')}>
      {(['id', 'en'] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
