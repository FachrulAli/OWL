import { Lang } from "./lang";

/**
 * Teks halaman #/agent dan #/deteksi dalam dua bahasa.
 *
 * Dipisah dari komponen supaya penyuntingan bahasa tidak menyentuh tata letak,
 * dan supaya kedua bahasa berdiri sejajar sehingga mudah terlihat bila salah
 * satunya tertinggal.
 *
 * Catatan gaya untuk teks Indonesia: tanpa em dash di badan prosa (pakai koma,
 * titik dua, atau pecah kalimat), tanpa "merupakan" sebagai kopula, dan tanpa
 * kalimat penutup bergaya pepatah.
 */
export const DOC = (l: Lang) => {
  const id = l === "id";
  return {
    nav: { home: id ? "Beranda" : "Home", console: id ? "Buka console" : "Open console" },

    /* ── console ──
       Istilah operasional (Kodam, Pussiberad, NRP, pangkat) tidak
       diterjemahkan: itu nama lembaga dan satuan, bukan kosakata umum. */
    con: {
      sub: id ? "Tier 0 · Pertahanan Ancaman Mobile" : "Tier 0 · Mobile Threat Defense",
      tagline: id
        ? "Satsiber TNI AD / Pussiberad · deteksi zero-click pada HP dinas, korelasi kill-chain, triase, dan eskalasi"
        : "Satsiber TNI AD / Pussiberad · zero-click detection on issued phones, kill-chain correlation, triage, escalation",
      home: id ? "Kembali ke beranda" : "Back to home",
      live: id ? "STREAM AKTIF" : "STREAM LIVE",
      demo: id ? "DEMO LANGSUNG" : "LIVE DEMO",
      reconnect: id ? "menyambung ulang…" : "reconnecting…",
      rules: id ? "Aturan deteksi" : "Detection rules",
      rulesTip: id
        ? "Lihat seluruh aturan deteksi yang dipakai: bobot, field yang dibaca, dan false positive yang diakui"
        : "See every detection rule in use: weights, fields read, and acknowledged false positives",
      agent: id ? "Pasang agent" : "Install agent",
      agentTip: id
        ? "Unduh agent MTD dan panduan pemasangannya di HP dinas"
        : "Download the MTD agent and its installation guide",
      spread: id ? "Sebaran Komando" : "Command Spread",
      nodes: id ? "NODE" : "NODES",
      filterTier: id ? "Saring tier" : "Filter tier",
      all: id ? "Semua" : "All",
      center: id ? "Pusat" : "HQ",
      kodam: "Kodam",
      openCard: id ? "buka kartu komando" : "open command card",
      high: id ? "tinggi" : "high",
      loadingNodes: id ? "Memuat node…" : "Loading nodes…",
      intel: id ? "Ringkasan Intel" : "Intel Summary",
      mDevices: id ? "HP dinas terpantau" : "Issued phones monitored",
      mHigh: id ? "Berisiko tinggi (≥70)" : "High risk (≥70)",
      mChains: id ? "Rantai kill-chain terbukti" : "Proven kill-chains",
      mCases: id ? "Kasus aktif" : "Open cases",
      mTop: id ? "Skor tertinggi · node kritis" : "Top score · critical nodes",
      feed: id ? "Aliran Langsung" : "Live Feed",
      realtime: id ? "realtime" : "realtime",
      waiting: id ? "Menunggu event…" : "Waiting for events…",
      chainFired: id ? "RANTAI TERBUKTI" : "CHAIN CONFIRMED",
      crossNode: id ? "KORELASI LINTAS NODE" : "CROSS-NODE CORRELATION",
      benign: id ? "indikator tunggal (bukan kasus)" : "single indicator (not a case)",
      latestChain: id ? "Rantai Terbaru · Rinci" : "Latest Chain · Detail",
      awaitChain: id ? "Menunggu rantai pertama…" : "Waiting for the first chain…",
      tableH: id ? "HP Dinas Berisiko Tertinggi" : "Highest-Risk Issued Phones",
      tableSub: id ? "klik satu baris untuk membuka riwayat perangkatnya"
                   : "click a row to open that device's history",
      cols: id ? ["Pemegang", "Perangkat", "Komando", "Risiko", "Status", "Terakhir lapor"]
               : ["Holder", "Device", "Command", "Risk", "Status", "Last report"],
      tableWait: id ? "Menunggu telemetri HP… (warm-up baseline)"
                    : "Waiting for phone telemetry… (baseline warm-up)",
      tableFoot: id
        ? "Nama personel pada data ini <b>fiktif</b>. Spesifikasi perangkat diambil dari telemetri terakhir yang diterima, bukan dari yang didaftarkan."
        : "Personnel names here are <b>fictional</b>. Device specs come from the most recent telemetry received, not from the registry.",
      liveAgentTip: id
        ? "Telemetri dari agent MTD sungguhan di perangkat, bukan simulasi"
        : "Telemetry from a real MTD agent on the device, not simulated",
      patchTip: id
        ? "Umur patch keamanan. Perangkat dengan patch kedaluwarsa rentan terhadap rantai eksploitasi yang sudah ditambal."
        : "Security patch age. Devices with stale patches are exposed to exploit chains that have already been fixed.",
      silentTip: id
        ? "Perangkat berhenti melapor. Pada sistem pemantauan, perangkat yang senyap bukan berarti aman, melainkan titik buta."
        : "The device stopped reporting. In monitoring, a silent device is not a safe device; it is a blind spot.",
      chainsH: id ? "Rantai Kill-Chain Terbukti" : "Confirmed Kill-Chains",
      chainsSub: id ? "korelasi Sigma terpenuhi, bukan indikator lepas"
                    : "a Sigma correlation was satisfied, not a loose indicator",
      chainsEmpty: id
        ? "Belum ada rantai terbukti. Indikator tunggal yang menyala sengaja tidak ditampilkan di sini, karena satu indikator tidak cukup untuk menuduh."
        : "No confirmed chain yet. Single indicators that fired are deliberately not shown here, because one indicator is not enough to accuse.",
      kcOrdered: id ? "BERURUTAN" : "ORDERED",
      kcRepeated: id ? "BERULANG" : "REPEATED",
      kcCo: id ? "BERSAMAAN" : "CO-OCCURRING",
      kcSpan: id ? "rantai" : "chain",
      kcWindow: id ? "dalam jendela" : "within a window of",
      kcAfter: id ? "setelah tahap sebelumnya" : "after the previous stage",
      kcIdle: id
        ? "Seluruh tahap di atas terjadi saat perangkat <b>idle</b>: layar mati, tanpa sentuhan, tanpa aplikasi di depan. Pemegang HP tidak melakukan apa pun."
        : "Every stage above happened while the device was <b>idle</b>: screen off, no touch, no app in the foreground. The holder did nothing.",
      kcAction: id ? "Tindakan disarankan" : "Recommended action",
      kcChains: id ? "rantai terbukti pada perangkat ini" : "confirmed chains on this device",
      kcNone: id
        ? "Tidak ada rantai terbukti pada perangkat ini. Indikator tunggal yang mungkin pernah menyala tidak cukup untuk menyimpulkan kompromi."
        : "No confirmed chain on this device. Single indicators that may have fired are not enough to conclude compromise.",
    },

    agent: {
      kicker: id ? "Pemasangan · agent MTD Android" : "Deployment · Android MTD agent",
      title: id ? "Pasang agent di HP dinas" : "Install the agent on issued phones",
      lede1: id
        ? "Agent mengirim <b>metadata perilaku</b> perangkat ke TRINETRA: layar nyala atau mati, jumlah byte naik-turun, suhu, aplikasi yang terpasang, dan apakah sebuah pesan masuk memunculkan notifikasi."
        : "The agent sends device <b>behavioural metadata</b> to TRINETRA: screen on or off, bytes up and down, temperature, installed apps, and whether an incoming message raised a notification.",
      lede2: id
        ? "Agent <b>tidak</b> mengambil keputusan deteksi. Itu dikerjakan di server, supaya perangkat yang sudah dikuasai penyerang tidak ikut menentukan hasil pemeriksaan atas dirinya sendiri."
        : "The agent makes <b>no</b> detection decisions. That happens on the server, so a device an attacker already controls has no say in the verdict about itself.",
      dlMain: id ? "Unduh APK agent" : "Download agent APK",
      dlMeta: "app-debug.apk · 8,1 MB · Android 10+",
      dlNote: id
        ? "Berkas <b>debug</b>, ditandatangani kunci pengembang, untuk uji coba dan bukan untuk disebar ke pasukan. Penggelaran sungguhan memakai APK rilis bertanda tangan resmi dan disebar lewat MDM."
        : "A <b>debug</b> build signed with a developer key, for testing and not for distribution to units. A real deployment uses an officially signed release APK pushed through MDM.",

      liveH: id ? "Agent yang sedang aktif" : "Agents reporting now",
      liveSub: id
        ? "Perangkat yang mengirim telemetri sungguhan, bukan dari simulator."
        : "Devices sending real telemetry, not simulator output.",
      liveEmpty: id
        ? "Belum ada perangkat yang mengirim telemetri sungguhan. Seluruh data di console saat ini berasal dari simulator."
        : "No device is sending real telemetry yet. Everything in the console right now comes from the simulator.",
      sending: id ? "mengirim" : "sending",

      stepsH: id ? "Langkah pemasangan" : "Installation steps",
      stepsSub: id
        ? "Empat langkah. Dua di antaranya tidak bisa dilewati tanpa membuat agent buta."
        : "Four steps. Two of them cannot be skipped without leaving the agent blind.",
      steps: [
        {
          h: id ? "Daftarkan perangkat lebih dulu" : "Register the device first",
          p: id
            ? "Server menolak telemetri dari perangkat yang tidak ada di registry. ID perangkat ditentukan satuan, bukan diklaim sendiri oleh aplikasi. Inilah yang mencegah sebuah HP mengaku sebagai HP perwira lain. Tunggu <b>sekitar 30 detik</b> setelah pendaftaran: server menyegarkan daftar identitas secara berkala, dan kiriman sebelum itu akan ditolak."
            : "The server rejects telemetry from devices that are not in the registry. The device ID is assigned by the unit, never claimed by the app itself. That is what stops one phone from posing as another officer's. Wait <b>about 30 seconds</b> after registering: the server refreshes its identity list periodically, and anything sent before that is rejected.",
        },
        {
          h: id ? "Izinkan pemasangan dari sumber ini" : "Allow installs from this source",
          p: id
            ? "Android akan menolak APK di luar Play Store sampai diizinkan. Setelan → Aplikasi → Akses khusus → Pasang aplikasi tak dikenal."
            : "Android blocks APKs from outside the Play Store until you allow them. Settings → Apps → Special access → Install unknown apps.",
        },
        {
          h: id ? "Pasang dan buka aplikasinya" : "Install and open the app",
          p: id
            ? "Isi alamat server, ID perangkat, dan token penggelaran, lalu tekan <b>Simpan &amp; mulai pemantauan</b>."
            : "Enter the server address, device ID, and deployment token, then tap <b>Save &amp; start monitoring</b>.",
        },
        {
          h: id ? "Aktifkan dua izin khusus" : "Turn on two special permissions",
          p: id
            ? "Keduanya tidak bisa diberikan lewat dialog biasa dan harus dinyalakan manual lewat tombol di layar aplikasi. Tanpa keduanya agent tetap berjalan, tetapi <b>buta terhadap sinyal terpentingnya</b>."
            : "Neither can be granted through a normal dialog; both must be enabled by hand using the buttons in the app. Without them the agent still runs, but it is <b>blind to its most important signals</b>.",
        },
      ],

      permH: id ? "Izin yang diminta" : "Permissions requested",
      permSub: id
        ? "Setiap izin dipakai untuk satu sinyal deteksi yang spesifik. Tidak ada izin yang diminta untuk nanti."
        : "Each permission serves one specific detection signal. Nothing is requested for later use.",
      permCols: id ? ["Izin", "Dipakai untuk", "Bila tidak diberikan"]
                   : ["Permission", "Used for", "If not granted"],
      perms: [
        { n: id ? "Akses Penggunaan" : "Usage Access", api: "PACKAGE_USAGE_STATS",
          u: id ? "Trafik keluar per selang waktu dan aplikasi yang sedang di depan. Keduanya dasar untuk mengenali aktivitas saat perangkat tidak dipakai."
                : "Outbound traffic per interval and the app currently in the foreground. Both underpin detecting activity while nobody is using the phone.",
          b: id ? "Sinyal eksfiltrasi tidak terbaca sama sekali." : "Exfiltration signals are not visible at all." },
        { n: id ? "Akses Notifikasi" : "Notification Access", api: "NotificationListenerService",
          u: id ? "Mengetahui apakah sebuah pesan masuk memunculkan notifikasi. Isi notifikasi tidak dibaca."
                : "Knowing whether an incoming message raised a notification. Notification contents are never read.",
          b: id ? "Pengiriman senyap, tahap pertama zero-click, tidak terdeteksi."
                : "Silent delivery, the first stage of zero-click, goes undetected." },
        { n: "SMS", api: "RECEIVE_SMS, RECEIVE_WAP_PUSH",
          u: id ? "Metadata pesan masuk: waktu, aplikasi, biner atau teks, dan hash pengirim. <b>Isi pesan tidak pernah dibaca.</b>"
                : "Inbound message metadata: time, app, binary or text, and a sender hash. <b>Message contents are never read.</b>",
          b: id ? "Vektor SMS biner operator tidak terpantau." : "The carrier binary-SMS vector is unmonitored." },
        { n: id ? "Status telepon" : "Phone state", api: "READ_PHONE_STATE",
          u: id ? "Generasi jaringan (2G/3G/4G/5G) untuk mengenali penurunan paksa ke 2G, pola khas IMSI catcher."
                : "Network generation (2G/3G/4G/5G) to spot a forced downgrade to 2G, the signature of an IMSI catcher.",
          b: id ? "Serangan radio tidak terdeteksi." : "Radio attacks go undetected." },
      ],

      privH: id ? "Yang diambil dan yang tidak" : "What is and is not collected",
      privSub: id
        ? "Daftar ini sama dengan yang tampil di layar aplikasi, supaya pemegang HP membaca hal yang sama sebelum dan sesudah memasang."
        : "This list matches what the app itself shows, so the phone's holder reads the same thing before and after installing.",
      privYes: id ? "Dikumpulkan" : "Collected",
      privNo: id ? "Tidak pernah diambil" : "Never collected",
      yes: id
        ? ["layar nyala/mati, aplikasi di depan", "jumlah byte naik/turun per selang waktu",
           "suhu perangkat, persen baterai, status pengisian", "mikrofon/kamera aktif atau tidak",
           "generasi jaringan seluler", "aplikasi baru terpasang dan sumber pemasangnya",
           "ada atau tidaknya notifikasi setelah pesan masuk", "hash pengirim pesan (satu arah, terpotong)"]
        : ["screen on/off, foreground app", "bytes up/down per interval",
           "device temperature, battery level, charging state", "microphone/camera active or not",
           "cellular network generation", "newly installed apps and their installer",
           "whether a notification followed an incoming message", "sender hash (one way, truncated)"],
      no: id
        ? ["isi pesan, isi notifikasi, isi berkas", "nomor telepon, daftar kontak",
           "lokasi, riwayat peramban", "tangkapan layar", "rekaman mikrofon atau kamera"]
        : ["message, notification, or file contents", "phone numbers, contact lists",
           "location, browsing history", "screenshots", "microphone or camera recordings"],
      privNote: id
        ? "Agent berjalan <b>terbuka</b>: ada notifikasi tetap di status bar selama pemantauan aktif, dan pemegang HP dapat menghentikannya kapan saja dari layar aplikasi. Keterbukaan ini bukan pilihan gaya. Agent yang menyembunyikan dirinya memakai teknik yang sama dengan stalkerware, dan program pemantauan yang diam-diam tidak akan bertahan begitu pasukan mengetahuinya."
        : "The agent runs <b>in the open</b>: a persistent status-bar notification stays up while monitoring is active, and the holder can stop it from the app at any time. This is not a stylistic choice. An agent that hides itself uses the same techniques as stalkerware, and a covert monitoring programme will not survive the moment the troops find out.",

      limH: id ? "Batas yang diakui" : "Limits we acknowledge",
      limSub: id
        ? "Disebut di sini supaya tidak ditemukan sendiri oleh orang yang menilai."
        : "Stated here so an evaluator does not have to discover them.",
      lims: [
        { h: id ? "Crash proses sistem tidak terbaca" : "System process crashes are not visible",
          p: id ? "Yaitu tahap eksploitasi pada rantai zero-click. Android hanya memberi riwayat keluar proses milik aplikasi sendiri. Agent melaporkan proksinya: lonjakan suhu saat perangkat idle. Versi presisi memerlukan agent sebagai aplikasi sistem pada perangkat yang di-provision sebagai Device Owner."
                : "That is the exploitation stage of the zero-click chain. Android only exposes exit records for an app's own processes. The agent reports a proxy instead: a thermal spike while the device is idle. The precise version requires the agent to ship as a system app on a Device Owner provisioned fleet." },
        { h: id ? "Tidak ada agent untuk iPhone" : "There is no iPhone agent",
          p: id ? "iOS tidak memberi aplikasi pihak ketiga akses ke proses sistem, sehingga pemantauan langsung tidak mungkin dilakukan aplikasi App Store mana pun. Jalur iOS di TRINETRA bersifat berkala: pemegang perangkat menarik bundel diagnostik, lalu dianalisis di server."
                : "iOS gives third-party apps no access to system processes, so continuous monitoring is impossible for any App Store app. TRINETRA's iOS path is periodic instead: the holder exports a diagnostic bundle, which is then analysed on the server." },
        { h: id ? "Belum diuji di perangkat fisik" : "Not yet tested on physical hardware",
          p: id ? "Agent sudah dikompilasi, dipasang, dijalankan, dan terbukti mengirim telemetri yang tembus ke dashboard, tetapi semua itu di emulator. Status termal, mikrofon/kamera, dan penurunan baterai alami belum teruji pada HP sungguhan."
                : "The agent compiles, installs, runs, and has been shown to deliver telemetry all the way to the dashboard, but all of that was on an emulator. Thermal status, microphone and camera use, and natural battery drain remain untested on a real phone." },
      ],
      foot: id
        ? "Rincian teknis, daftar sinyal, dan cara membangun dari sumber ada di <b>agent/README.md</b> di repositori."
        : "Technical detail, the full signal list, and build-from-source instructions live in <b>agent/README.md</b> in the repository.",
    },

    det: {
      kicker: id ? "Transparansi · deteksi sebagai kode" : "Transparency · detection as code",
      title: id ? "Aturan yang dipakai TRINETRA" : "The rules TRINETRA runs on",
      lede1: id
        ? "Seluruh logika deteksi ditulis dalam <b>format Sigma</b>, standar terbuka untuk aturan deteksi yang spesifikasinya berstatus domain publik."
        : "Every detection rule is written in <b>Sigma format</b>, an open standard for detection logic whose specification is public domain.",
      lede2: id
        ? "Artinya aturan di bawah bukan kotak hitam: bisa dibaca, dikritik, diperbaiki, dan dibagikan antar satuan sebagai berkas teks biasa."
        : "That means the rules below are not a black box. They can be read, challenged, corrected, and shared between units as plain text files.",
      note: id
        ? "<b>Prinsip yang menentukan semua angka di halaman ini:</b> aturan atomik sengaja diberi bobot rendah, 8 sampai 45, karena satu indikator perilaku di HP selalu ambigu. Tuduhan hanya lahir dari <b>correlation rule</b> dengan bobot 30 sampai 85, yang menuntut beberapa aturan menyala <b>berurutan</b> pada satu perangkat dalam jendela waktu pendek. Detektor yang menuduh dari satu indikator akan menghasilkan alarm palsu setiap hari, dan operator berhenti membukanya dalam hitungan minggu."
        : "<b>The principle behind every number on this page:</b> atomic rules carry deliberately low weights, 8 to 45, because a single behavioural indicator on a phone is always ambiguous. An accusation only comes from a <b>correlation rule</b> weighted 30 to 85, which requires several rules to fire <b>in order</b> on one device inside a short window. A detector that accuses on one indicator produces false alarms daily, and operators stop opening them within weeks.",
      corrH: id ? "Correlation rule" : "Correlation rules",
      corrSub: id
        ? "Di sinilah zero-click ditangkap. <code>temporal_ordered</code> menuntut aturan menyala dalam urutan tertentu di dalam satu rentang waktu; <code>event_count</code> menuntut satu aturan berulang; <code>temporal</code> hanya menuntut bersamaan."
        : "This is where zero-click is caught. <code>temporal_ordered</code> requires rules to fire in a specific order within one window; <code>event_count</code> requires one rule to repeat; <code>temporal</code> only requires co-occurrence.",
      atomH: id ? "Aturan atomik" : "Atomic rules",
      atomSub: id
        ? "Masing-masing mengamati satu perilaku. Kolom terakhir bukan kelemahan yang disembunyikan: mencantumkan false positive adalah bagian wajib sebuah aturan Sigma, dan justru menjelaskan mengapa aturan ini tidak boleh dipakai sendirian."
        : "Each watches a single behaviour. The last column is not a hidden weakness: listing false positives is a required part of a Sigma rule, and it explains exactly why these must not be used alone.",
      atomCols: id ? ["Aturan", "Tahap", "Bobot", "Field yang dibaca", "Diakui bisa salah karena"]
                   : ["Rule", "Stage", "Weight", "Fields read", "Known to misfire on"],
      iocH: id ? "Lapisan intel" : "Intelligence layer",
      iocSub1: id ? "indikator dari" : "indicators from",
      iocSub2: id ? "kampanye spyware yang dipublikasikan. Lapisan ini hanya mengenali infrastruktur yang <b>sudah diketahui</b>; tugas mengenali yang belum dikenal ada pada aturan perilaku di atas."
                  : "published spyware campaigns. This layer only recognises <b>already known</b> infrastructure; recognising the unknown is the job of the behavioural rules above.",
      license: id ? "lisensi" : "licence",
      window: id ? "jendela" : "window",
      atLeast: id ? "minimal" : "at least",
      groupedBy: id ? "dikelompokkan per" : "grouped by",
      weight: id ? "bobot" : "weight",
      becauseOf: id ? "Bisa salah karena:" : "Can misfire on:",
      loading: id ? "Memuat katalog aturan…" : "Loading the rule catalogue…",
      loadingIoc: id ? "Memuat status indikator…" : "Loading indicator status…",
      format: id ? "Format" : "Format",
      footRepo: id
        ? "Aturan dalam repositori: <b>mobile_atomic.yml</b> dan <b>mobile_correlation.yml</b>. Aturan SigmaHQ publik berlisensi DRL 1.1 yang mewajibkan atribusi penulis; seluruh aturan di halaman ini ditulis untuk TRINETRA."
        : "Rules in the repository: <b>mobile_atomic.yml</b> and <b>mobile_correlation.yml</b>. Public SigmaHQ rules carry the DRL 1.1 licence, which requires author attribution; every rule on this page was written for TRINETRA.",
      badges: id ? { temporal_ordered: "BERURUTAN", event_count: "BERULANG", temporal: "BERSAMAAN" }
                 : { temporal_ordered: "ORDERED", event_count: "REPEATED", temporal: "CO-OCCURRING" },
    },
  };
};

export type DocText = ReturnType<typeof DOC>;
