/**
 * Tautan unduh APK agent OWL.
 *
 * ————————————————————————————————————————————————————————————————
 *  ISI NILAI DI BAWAH INI ketika APK rilis sudah diunggah.
 * ————————————————————————————————————————————————————————————————
 *
 * Dua tempat yang masuk akal, pilih salah satu:
 *
 *   1. GitHub Release  — tidak membebani repositori dengan biner tujuh
 *      megabyte, dan tiap versi punya alamatnya sendiri. Contoh:
 *      'https://github.com/FachrulAli/OWL/releases/latest/download/owl-agent.apk'
 *
 *   2. Berkas statis di situs — taruh APK-nya di `frontend/public/`, lalu
 *      isi '/owl-agent.apk'. Juri dapat mengunduh dari halaman yang sama
 *      tanpa akun GitHub, tetapi binernya ikut masuk ke repositori.
 *
 * Selama nilainya kosong, tombolnya tetap tampil tetapi mati dan
 * mengatakan bahwa tautannya menyusul. Itu disengaja: tombol yang
 * menghilang membuat orang mengira fiturnya tidak ada, sedangkan tombol
 * yang mati tetapi menerangkan dirinya menyebutkan apa yang sedang
 * ditunggu. Yang tidak boleh adalah tombol hidup menuju alamat kosong.
 *
 * APK-nya WAJIB yang bertanda tangan rilis dari
 * `services/backend/tools/build_agent_release.py`, bukan APK debug.
 * Keduanya tidak dapat saling menimpa saat dipasang, sebab Android
 * menolak pembaruan yang kunci penanda tangannya berbeda.
 */
export const UNDUH_AGENT = ''

/** Keterangan singkat di bawah tombol: versi dan ukuran, bila diketahui. */
export const AGENT_INFO = ''
