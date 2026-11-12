import { useEffect, useState } from "react";
import { api, Entity } from "./lib/api";
import { fmtTime, silence } from "./lib/util";

const APK = "/trinetra-agent.apk";

/**
 * Halaman pemasangan agent MTD.
 *
 * Dibuat karena kesenjangan yang nyata: seluruh sistem bergantung pada agent
 * di perangkat, tetapi tidak ada satu pun tempat untuk mengunduhnya atau
 * mengetahui cara memasangnya. Halaman ini juga berfungsi sebagai lembar
 * persetujuan: pemegang HP membaca apa yang dikumpulkan SEBELUM memasang,
 * bukan sesudah.
 */
export default function Agent(
  { onExit, onConsole }: { onExit: () => void; onConsole: () => void },
) {
  const [live, setLive] = useState<Entity[]>([]);

  useEffect(() => {
    const load = () => api.entities()
      .then((e) => setLive(e.filter((x) => x.live_agent)))
      .catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="doc">
      <div className="doc-top">
        <button className="pg-nav" onClick={onExit}><span className="ix">←</span> Beranda</button>
        <button className="pg-nav" onClick={onConsole}>Buka console <span className="ix">→</span></button>
      </div>

      <header className="doc-head">
        <div className="doc-kicker">Pemasangan · agent MTD Android</div>
        <h1>Pasang agent di HP dinas</h1>
        <p className="doc-lede">
          Agent mengirim <b>metadata perilaku</b> perangkat ke TRINETRA: layar
          nyala atau mati, jumlah byte naik-turun, suhu, aplikasi yang
          terpasang, dan apakah sebuah pesan masuk memunculkan notifikasi.
          Agent <b>tidak</b> mengambil keputusan deteksi. Itu dikerjakan di
          server, supaya perangkat yang sudah dikuasai penyerang tidak ikut
          menentukan hasil pemeriksaan atas dirinya sendiri.
        </p>

        <div className="dl-row">
          <a className="dl-btn" href={APK} download>
            <span className="dl-icon" aria-hidden="true">↓</span>
            <span>
              <span className="dl-main">Unduh APK agent</span>
              <span className="dl-meta">app-debug.apk · 8,1 MB · Android 10+</span>
            </span>
          </a>
          <div className="dl-side">
            Berkas <b>debug</b>, ditandatangani kunci pengembang, untuk uji coba
            dan bukan untuk disebar ke pasukan. Penggelaran sungguhan memakai
            APK rilis bertanda tangan resmi dan disebar lewat MDM.
          </div>
        </div>
      </header>

      {/* ── status agent yang sedang hidup ── */}
      <section className="doc-sec">
        <h2>Agent yang sedang aktif<span className="doc-count">{live.length}</span></h2>
        {live.length === 0 ? (
          <p className="doc-sub">
            Belum ada perangkat yang mengirim telemetri sungguhan. Seluruh data
            di console saat ini berasal dari simulator.
          </p>
        ) : (
          <div className="live-list">
            {live.map((e) => {
              const sil = silence(e.last_seen ?? e.last_event);
              return (
                <div key={e.entity_id} className="live-row">
                  <div>
                    <b>{e.holder_rank} {e.holder_name}</b>
                    <div className="dev-sub">
                      <span className="mono">{e.entity_id}</span>
                      <span>{e.device_model}</span>
                      <span>Android {e.os_version}</span>
                    </div>
                  </div>
                  <div className="live-right">
                    <span className={`dev-tag ${sil.stale ? "" : "live"}`}>
                      {!sil.stale && <span className="live-dot" />}
                      {sil.stale ? sil.label : "mengirim"}
                    </span>
                    <span className="muted" style={{ fontSize: 11 }}>
                      {fmtTime(e.last_seen ?? e.last_event)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── langkah pemasangan ── */}
      <section className="doc-sec">
        <h2>Langkah pemasangan</h2>
        <ol className="steps">
          <li>
            <h3>Daftarkan perangkat lebih dulu</h3>
            <p>
              Server menolak telemetri dari perangkat yang tidak ada di
              registry. ID perangkat ditentukan satuan, bukan diklaim sendiri
              oleh aplikasi. Inilah yang mencegah sebuah HP mengaku sebagai HP
              perwira lain. Tunggu <b>sekitar 30 detik</b> setelah pendaftaran:
              server menyegarkan daftar identitas secara berkala, dan kiriman
              sebelum itu akan ditolak.
            </p>
          </li>
          <li>
            <h3>Izinkan pemasangan dari sumber ini</h3>
            <p>
              Android akan menolak APK di luar Play Store sampai diizinkan.
              Setelan → Aplikasi → Akses khusus → Pasang aplikasi tak dikenal.
            </p>
          </li>
          <li>
            <h3>Pasang dan buka aplikasinya</h3>
            <p>
              Isi alamat server, ID perangkat, dan token penggelaran, lalu tekan
              <b> Simpan &amp; mulai pemantauan</b>.
            </p>
          </li>
          <li>
            <h3>Aktifkan dua izin khusus</h3>
            <p>
              Keduanya tidak bisa diberikan lewat dialog biasa dan harus
              dinyalakan manual lewat tombol di layar aplikasi. Tanpa
              keduanya agent tetap berjalan, tetapi <b>buta terhadap sinyal
              terpentingnya</b>.
            </p>
          </li>
        </ol>
      </section>

      {/* ── izin dan alasannya ── */}
      <section className="doc-sec">
        <h2>Izin yang diminta, dan alasannya</h2>
        <p className="doc-sub">
          Setiap izin dipakai untuk satu sinyal deteksi yang spesifik. Tidak ada
          izin yang diminta "untuk nanti".
        </p>
        <div className="doc-table-wrap">
          <table className="doc-table">
            <thead>
              <tr><th>Izin</th><th>Dipakai untuk</th><th>Bila tidak diberikan</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><b>Akses Penggunaan</b><div className="doc-id">PACKAGE_USAGE_STATS</div></td>
                <td>Trafik keluar per selang waktu dan aplikasi yang sedang di depan. Keduanya dasar untuk mengenali aktivitas saat perangkat tidak dipakai.</td>
                <td className="doc-fp-cell">Sinyal eksfiltrasi tidak terbaca sama sekali.</td>
              </tr>
              <tr>
                <td><b>Akses Notifikasi</b><div className="doc-id">NotificationListenerService</div></td>
                <td>Mengetahui apakah sebuah pesan masuk <i>memunculkan</i> notifikasi. Isi notifikasi tidak dibaca.</td>
                <td className="doc-fp-cell">Pengiriman senyap, tahap pertama zero-click, tidak terdeteksi.</td>
              </tr>
              <tr>
                <td><b>SMS</b><div className="doc-id">RECEIVE_SMS, RECEIVE_WAP_PUSH</div></td>
                <td>Metadata pesan masuk: waktu, aplikasi, biner atau teks, dan hash pengirim. <b>Isi pesan tidak pernah dibaca.</b></td>
                <td className="doc-fp-cell">Vektor SMS biner operator tidak terpantau.</td>
              </tr>
              <tr>
                <td><b>Status telepon</b><div className="doc-id">READ_PHONE_STATE</div></td>
                <td>Generasi jaringan (2G/3G/4G/5G) untuk mengenali penurunan paksa ke 2G, pola khas IMSI catcher.</td>
                <td className="doc-fp-cell">Serangan radio tidak terdeteksi.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── privasi ── */}
      <section className="doc-sec">
        <h2>Yang tidak pernah diambil</h2>
        <div className="privacy">
          <div className="privacy-col yes">
            <h3>Dikumpulkan</h3>
            <ul>
              <li>layar nyala/mati, aplikasi di depan</li>
              <li>jumlah byte naik/turun per selang waktu</li>
              <li>suhu perangkat, persen baterai, status pengisian</li>
              <li>mikrofon/kamera aktif atau tidak</li>
              <li>generasi jaringan seluler</li>
              <li>aplikasi baru terpasang + sumber pemasangnya</li>
              <li>ada/tidak notifikasi setelah pesan masuk</li>
              <li>hash pengirim pesan (satu arah, terpotong)</li>
            </ul>
          </div>
          <div className="privacy-col no">
            <h3>Tidak pernah diambil</h3>
            <ul>
              <li>isi pesan, isi notifikasi, isi berkas</li>
              <li>nomor telepon, daftar kontak</li>
              <li>lokasi, riwayat peramban</li>
              <li>tangkapan layar</li>
              <li>rekaman mikrofon atau kamera</li>
            </ul>
          </div>
        </div>
        <div className="doc-note" style={{ marginTop: 14 }}>
          Agent berjalan <b>terbuka</b>: ada notifikasi tetap di status bar
          selama pemantauan aktif, dan pemegang HP dapat menghentikannya kapan
          saja dari layar aplikasi. Keterbukaan ini bukan pilihan gaya. Agent
          yang menyembunyikan dirinya memakai teknik yang sama dengan
          stalkerware, dan program pemantauan yang diam-diam tidak akan
          bertahan begitu pasukan mengetahuinya.
        </div>
      </section>

      {/* ── batas yang diakui ── */}
      <section className="doc-sec">
        <h2>Batas yang diakui</h2>
        <div className="limits">
          <div className="limit-card">
            <h3>Crash proses sistem tidak terbaca</h3>
            <p>
              Yaitu tahap <i>eksploitasi</i> pada rantai zero-click. Android
              hanya memberi riwayat keluar proses milik aplikasi sendiri. Agent
              melaporkan proksinya: lonjakan suhu saat perangkat idle. Versi
              presisi memerlukan agent sebagai aplikasi sistem pada perangkat
              dinas yang di-provision sebagai Device Owner.
            </p>
          </div>
          <div className="limit-card">
            <h3>Tidak ada agent untuk iPhone</h3>
            <p>
              iOS tidak memberi aplikasi pihak ketiga akses ke proses sistem,
              sehingga pemantauan langsung tidak mungkin dilakukan aplikasi App
              Store mana pun. Jalur iOS di TRINETRA bersifat berkala: pemegang
              perangkat menarik bundel diagnostik, lalu dianalisis di server.
            </p>
          </div>
          <div className="limit-card">
            <h3>Belum diuji di perangkat fisik</h3>
            <p>
              Agent sudah dikompilasi, dipasang, dijalankan, dan terbukti
              mengirim telemetri yang tembus ke dashboard, tetapi semua itu di
              emulator. Status termal, mikrofon/kamera, dan penurunan baterai
              alami belum teruji pada HP sungguhan.
            </p>
          </div>
        </div>
      </section>

      <footer className="doc-foot">
        Rincian teknis, daftar sinyal, dan cara membangun dari sumber ada di{" "}
        <span className="mono">agent/README.md</span> di repositori.
      </footer>
    </div>
  );
}
