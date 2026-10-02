# Jawaban Teknis & Keputusan Desain

Dokumen ini merangkum jawaban untuk pertanyaan esai Bagian 5 serta pertimbangan keputusan desain arsitektur pada Bagian A, B, C, D, E, dan G. Penjelasan disusun secara ringkas, to the point, dan menitikberatkan pada alasan teknis praktis di implementasi lapangan.

---

## Bagian 5: Soal Esai Singkat

### 1. Kenapa data time-series sebaiknya tidak di-UPDATE, dan lebih baik append-only?

Data time-series pada dasarnya adalah rekaman kejadian nyata di masa lalu. Suhu jam 10 pagi tadi adalah fakta yang sudah terjadi dan tidak akan berubah lagi. Dari sisi database, operasi UPDATE di PostgreSQL tidak langsung menimpa data lama di disk, melainkan membuat salinan baris baru. Hal ini membuat tabel cepat membengkak dan memberatkan database karena harus sering melakukan pembersihan disk.

Dengan pendekatan append-only (hanya menambahkan baris baru), penulisan data jauh lebih cepat, database tidak perlu repot mengunci baris data, dan data mentah aslinya tetap aman tersimpan untuk kebutuhan audit jika suatu saat ada sensor yang bermasalah.

### 2. Apa itu hypertable dan continuous aggregate di TimescaleDB? Kalau hanya pakai PostgreSQL biasa, bagaimana mencapai efek yang sama?

Hypertable di TimescaleDB adalah tabel khusus yang otomatis memecah data besar menjadi partisi-partisi kecil berdasarkan rentang waktu. Tujuannya agar saat query data bulan ini, database tidak perlu memindai data setahun yang lalu. Sedangkan continuous aggregate berfungsi seperti ringkasan otomatis di background; setiap ada data baru masuk, sistem langsung menghitung agregasi seperti rata-rata per jam atau harian. Dengan begitu, saat dashboard dibuka, aplikasi tidak perlu menghitung ulang jutaan baris data dari awal.

Jika hanya menggunakan PostgreSQL standar tanpa ekstensi Timescale, bisa menerapkan partisi tabel bawaan Postgres yang dipotong per bulan. Untuk ringkasan datanya, saya membuat tabel rekap tersendiri dan menjalankan worker di background secara berkala untuk mengisi nilai agregasinya.

### 3. Jelaskan perbedaan menghitung rata-rata arah angin dengan rata-rata suhu. Bagaimana cara yang benar?

Suhu adalah nilai skalar biasa, sehingga untuk mencari rata-ratanya cukup menjumlahkan seluruh nilai pembacaan lalu dibagi dengan jumlah datanya. Sebaliknya, arah angin adalah nilai sudut yang berputar dalam lingkaran 360 derajat.

Sebagai contoh, arah 350 derajat dan 10 derajat sebenarnya sama-sama mengarah ke utara dengan perbedaan sudut yang kecil. Jika dirata-ratakan seperti angka biasa, hasilnya justru menjadi 180 derajat alias mengarah ke selatan, yang tentu tidak sesuai dengan kondisi alam sebenarnya.

Cara yang benar adalah memecah sudut arah angin tersebut ke dalam komponen arah mata angin (sumbu utara-selatan dan timur-barat), menjumlahkan masing-masing komponen arahnya, kemudian menghitung kembali sudut rata-ratanya dari hasil penjumlahan tersebut. Dengan cara ini, arah angin rata-rata tetap mengarah ke utara secara akurat.

### 4. Data masuk 50 device x 7 sensor tiap menit. Bandingkan insert satu per satu vs bulk insert/batching. Berapa bedanya dan kenapa?

Perbedaannya sangat signifikan, bulk insert bisa puluhan kali lipat lebih cepat dibanding insert satu per satu.

Jika di-insert satu per satu, aplikasi harus mengirimkan 350 permintaan terpisah ke database setiap menitnya. Database juga terpaksa membuka-tutup transaksi dan menulis log disk sebanyak 350 kali. Akibatnya terjadi antrean jaringan dan beban CPU serta disk database meningkat drastis.

Sebaliknya, dengan bulk insert, 350 data pembacaan dibungkus menjadi satu transaksi tunggal. Database hanya perlu mengalokasikan memori dan menulis ke disk satu kali saja, sehingga proses selesai dalam beberapa milidetik dan sumber daya server tetap terjaga hemat.

### 5. Index apa yang Anda buat di tabel sensor_reading, dan urutan kolomnya bagaimana? Kenapa urutan itu penting?

Index yang dibuat di tabel sensor_readings adalah composite index dengan urutan kolom: device_id, sensor_type_id, lalu waktu data (time) secara descending.

Urutan ini sangat penting karena menyesuaikan pola query pada dashboard: pengguna biasanya memilih stasiun tertentu terlebih dahulu, kemudian memilih jenis sensor yang ingin dilihat, lalu menentukan rentang waktu atau mencari data pembacaan paling baru.

Jika urutan kolomnya terbalik, misalnya kolom waktu ditaruh paling depan, database harus memeriksa seluruh data waktu dari semua stasiun yang ada sebelum memfilter stasiunnya. Hal ini akan membuat query menjadi lambat saat jumlah data sudah mencapai jutaan baris.

### 6. Bagaimana Anda mendeteksi sensor yang "macet" mengirim data terus tapi nilainya identik selama 6 jam?

Sensor macet dapat diidentifikasi ketika perangkat tetap aktif mengirimkan paket data setiap menit, namun nilainya sama persis selama berjam-jam tanpa ada fluktuasi (misalnya suhu outdoor bernilai 26.5 konstan dari siang hingga malam, padahal kondisi suhu lingkungan luar ruangan normalnya selalu dinamis).

Cara mendeteksinya adalah dengan menjalankan pengecekan berkala di background. Sistem memeriksa data dalam rentang 6 jam terakhir; jika jumlah datanya lengkap namun variasi nilainya nol atau tidak ada pergerakan sama sekali pada sensor yang seharusnya dinamis, sistem langsung menandai sensor tersebut sebagai bermasalah (stuck sensor) dan mengirimkan notifikasi ke tim operasional untuk pemeriksaan fisik.

### 7. Ada permintaan menambah alert: kirim notifikasi jika curah hujan > 20 mm/jam. Di lapisan mana Anda menaruh logika ini, dan kenapa di situ?

Logika alert ini sebaiknya diletakkan pada worker background yang memproses rollup agregasi data berkala, bukan pada endpoint penerimaan data HTTP dan bukan pada trigger database.

Alasannya, endpoint penerimaan data harus bekerja secepat mungkin menerima paket dan mengembalikan respon sukses agar koneksi perangkat tidak tertahan dan baterai alat tetap hemat. Alasannya tidak ingin perangkat gagal mengirim data hanya karena server sedang menunggu proses kirim notifikasi eksternal.

Pada worker background, data curah hujan sudah terkumpul dan terhitung totalnya per jam. Begitu sistem mendeteksi total curah hujan melampaui 20 mm dalam satu jam tersebut, worker langsung mendaftarkan tugas pengiriman notifikasi ke antrean terpisah tanpa mengganggu proses penerimaan data utama.

### 8. Apa saja risiko keamanan pada endpoint ingestion yang terbuka ke internet, dan bagaimana mitigasinya?

Risiko utamanya meliputi serangan banjir request (DDoS) yang dapat membuat server down, pihak luar yang memalsukan identitas perangkat untuk memasukkan data cuaca palsu, pengiriman ulang paket data yang sama (replay attack), serta pengiriman payload berbahaya yang berpotensi merusak server.

Langkah mitigasi yang diterapkan:

- Setiap stasiun wajib menyertakan API key unik yang diverifikasi menggunakan hashing di server, sehingga request tanpa kunci valid langsung ditolak.
- Menerapkan pembatasan laju request (rate limiting) berbasis Redis agar tidak ada pihak yang dapat membanjiri server dengan request berlebih.
- Membatasi perbedaan waktu antara jam perangkat dan jam server (maksimal toleransi 5 menit) untuk mencegah serangan pemutaran ulang paket lama.
- Menerapkan validasi skema input yang ketat serta pembatasan ukuran payload sebelum data diproses oleh aplikasi.

---

## Bagian A: Keputusan Desain Device Management

### A.1 Apa yang terjadi pada data historis ketika sebuah device di-decommission? Kenapa memilih pendekatan itu?

Data historis tetap disimpan secara utuh dan tidak boleh dihapus dari database. Yang diubah hanyalah status perangkat menjadi decommissioned, serta mencabut akses API key perangkat tersebut agar tidak bisa lagi mengirimkan data baru.

Pendekatan ini dipilih karena data cuaca masa lalu merupakan catatan riwayat lingkungan yang berharga. Data tersebut mungkin sudah digunakan dalam laporan operasional, kajian analisis iklim, atau pemantauan bencana. Menghapus data historis akan merusak validitas laporan yang sudah terbit dan menghilangkan data yang tidak mungkin bisa diambil ulang.

### A.2 Bagaimana Anda membedakan "device mati" dengan "device hidup tapi jaringan putus"?

Perbedaannya dapat diidentifikasi dari telemetri terakhir sebelum perangkat hilang kontak dan perilaku perangkat saat kembali terhubung:

Pertama, dari status baterai dan sinyal terakhir. Jika sebelum putus kontak voltase baterai terdeteksi turun drastis di bawah ambang batas aman namun sinyal masih normal, kemungkinan besar perangkat mati karena kehabisan daya. Namun jika baterai masih penuh dan sinyal yang mendadak hilang (misalnya saat terjadi cuaca buruk), besar kemungkinan perangkat masih menyala tetapi kehilangan koneksi jaringan.

Kedua, saat perangkat online kembali. Perangkat yang hanya mengalami gangguan jaringan umumnya akan langsung mengirimkan data tumpukan yang sempat disimpan di memori lokal selama offline. Sebaliknya, perangkat yang mati total biasanya tidak memiliki data selama periode mati dan penghitung sensor tertentu (seperti rain gauge) sering kali ter-reset kembali ke nilai awal.

---

## Bagian B: Keputusan Desain Sensor Management

### B.1 Sensor suhu pada device A dipindah ke device B pada 1 Juni. Bagaimana skema menjamin data sebelum 1 Juni tetap terhubung ke device A?

Pada skema database, saya memisahkan tabel aset sensor fisik dengan tabel riwayat pemasangan sensor. Tabel riwayat ini mencatat kapan sensor mulai dipasang dan kapan dilepas pada suatu stasiun. Ketika sensor dipindahkan ke stasiun B per 1 Juni, catatan pemasangan di stasiun A diberi tanggal selesai 1 Juni, dan dibuat catatan baru untuk stasiun B mulai tanggal 1 Juni.

Selain itu, setiap baris data pembacaan yang masuk selalu mencatat ID stasiun secara langsung pada saat data direkam. Dengan demikian, ketika menarik data sebelum 1 Juni, data tersebut tetap terhubung secara pasti ke stasiun A tanpa risiko tertukar.

### B.2 Nilai kalibrasi diubah hari ini. Apakah data lama ikut berubah? Jelaskan konsekuensi dari pilihan Anda.

Data lama tidak boleh ikut berubah secara otomatis. Nilai kalibrasi yang baru hanya diterapkan untuk data pembacaan yang masuk mulai hari ini ke depan.

Konsekuensinya, data masa lalu tetap konsisten dengan apa yang sudah dilihat pengguna dan dilaporkan sebelumnya, sehingga tidak menimbulkan kebingungan operasional. Namun, untuk menjaga fleksibilitas ilmiah, sistem tetap menyimpan nilai mentah asli dari sensor di kolom terpisah. Jika di kemudian hari tim analis membutuhkan perhitungan ulang data historis menggunakan parameter kalibrasi baru, data mentahnya tetap tersedia dan dapat dihitung tanpa merusak data yang sudah ada.

---

## Bagian C: Keputusan Desain Kapasitas & Pertumbuhan Data

### C.1 Tabel mana yang akan tumbuh paling cepat? Perkirakan jumlah row per tahun.

Tabel yang akan tumbuh paling cepat adalah tabel data pembacaan sensor (sensor_readings).

Gambarannya, dengan 50 stasiun cuaca yang masing-masing memiliki 7 sensor dan mengirim data setiap menit, sistem menerima 350 baris data per menit. Dalam satu jam terdapat 21.000 baris, dan dalam sehari mencapai sekitar 504.000 baris.

Dalam setahun penuh, total data yang terkumpul dapat mencapai sekitar 184 juta baris, dengan estimasi kebutuhan ruang penyimpanan berkisar antara 18 hingga 25 Gigabyte per tahun termasuk index databasenya.

### C.2 Strategi menghadapi pertumbuhan data dan trade-off-nya

Strategi yang diterapkan adalah membagi beban melalui partisi tabel dan agregasi bertingkat.

Tabel data mentah dipartisi per bulan agar ukuran tabel tetap terkendali dan query tidak terbebani saat memindai data lama. Untuk kebutuhan visualisasi di dashboard, sistem tidak membaca langsung dari tabel data mentah, melainkan dari tabel rekap per jam atau per hari yang telah dihitung oleh worker di background.

Tabel rekap ini ukurannya sangat ringkas (kurang dari satu juta baris per tahun). Trade-off-nya, jika kapasitas penyimpanan mulai terbatas, partisi data mentah yang sudah lewat beberapa bulan dapat diarsipkan atau dihapus tanpa mengorbankan tampilan tren grafik jangka panjang pada dashboard.

### C.3 Format Wide vs Narrow/Long: Mana yang Dipilih dan Kenapa?

Saya memilih format narrow (satu baris mewakili satu jenis sensor).

Alasannya adalah fleksibilitas skema. Stasiun cuaca di lapangan sering kali memiliki konfigurasi sensor yang berbeda-beda; ada stasiun dengan sensor lengkap, dan ada yang hanya memiliki beberapa sensor. Jika di kemudian hari perlu ditambahkan sensor baru, kita cukup menambahkan tipe sensor baru di database tanpa perlu mengubah struktur kolom tabel pada database produksi.

Agar frontend tetap mudah menampilkan grafik yang membutuhkan gabungan beberapa parameter sensor sekaligus, API backend secara otomatis menyusun data narrow tersebut menjadi format yang siap dikonsumsi oleh komponen chart.

---

## Bagian D: Keputusan Desain Alur & Keandalan Data

### D.1 Idempotensi: Cara Mencegah Data Masuk Dobel

Pencegahan data duplikat diterapkan dalam dua lapisan:

Pertama di memori Redis, setiap paket data yang masuk dibuatkan kunci unik berdasarkan identitas perangkat dan waktu pembacaannya. Jika perangkat mengirimkan ulang paket yang identik (misalnya karena gangguan sinyal saat menunggu respon server), sistem langsung mengembalikan respon sukses dari cache tanpa menulis ulang ke database.

Kedua di tingkat database, tabel pembacaan dilengkapi constraint unik sehingga jika ada request duplikat yang lolos bersamaan, database secara otomatis menolak data yang kedua.

### D.2 Data Terlambat & Tidak Berurutan (Offline 3 Jam lalu Kirim 180 Record)

Sistem menyediakan endpoint khusus batch yang mampu menerima ratusan data sekaligus. Data pembacaan disimpan ke database berdasarkan waktu kejadian aslinya saat direkam oleh perangkat di lapangan.

Untuk menjaga keakuratan grafik di dashboard pada jam-jam yang terlewat, sistem akan menginstruksikan worker background untuk menghitung ulang agregasi pada rentang waktu yang baru masuk tersebut, sehingga grafik tetap konsisten dan tidak ada data yang terlewat.

### D.3 Mengatasi Lonjakan Trafik pas 50 Stasiun Kirim Barengan

Koneksi ke database dikelola melalui connection pool agar database tidak mengalami kehabisan sumber daya saat terjadi lonjakan trafik bersamaan. Penulisan ke database dilakukan secara bulk (multi-row insert) dalam satu transaksi. Jika trafik sangat tinggi, paket data dapat diterima terlebih dahulu ke dalam antrean memori Redis dengan respon cepat ke perangkat, kemudian worker di background akan memproses penulisan ke disk secara bertahap.

### D.4 Beda Waktu Jam Alat dan Jam Server (Clock Drift)

Waktu pada perangkat sensor (device time) dijadikan acuan utama sebagai representasi waktu terjadinya kondisi cuaca di lapangan. Waktu server dicatat sebagai penanda kapan paket tersebut diterima oleh sistem.

Jika waktu pada perangkat tertinggal karena offline, data tetap diterima secara normal. Namun jika jam perangkat mengalami anomali dan bernilai lebih dari 5 menit ke masa depan dibanding jam server, data tetap disimpan tetapi diberi penanda khusus agar tidak merusak urutan visualisasi grafik.

### D.5 Standarisasi Waktu (Timezone)

Pada database, seluruh data tanggal dan waktu disimpan secara konsisten menggunakan format UTC. Konversi ke Waktu Indonesia Barat (WIB / UTC+7) hanya dilakukan pada lapisan presentasi saat data ditampilkan di browser pengguna. Dengan cara ini, jika di masa mendatang sistem diperluas ke zona waktu lain seperti WITA atau WIT, data tidak akan mengalami benturan timezone.

### D.6 Kalau Database Lagi Mati, Apakah Data Hilang?

Data tidak akan hilang. Jika database sedang tidak dapat diakses, server API akan mengembalikan respon error ke perangkat.

Firmware pada stasiun cuaca telah dirancang untuk menyimpan data pembacaan di memori non-volatile lokal selama belum menerima konfirmasi sukses dari server. Perangkat akan mencoba mengirimkan kembali data tersebut secara berkala. Begitu database kembali normal, seluruh data yang sempat tertahan akan terkirim secara lengkap.

---

## Bagian E: Keputusan Desain API & Ingestion

### E.1 Mencegah Respon Data 1 Tahun Membengkak

Jika pengguna meminta data rentang satu tahun dalam resolusi per menit, payload respon akan memuat ratusan ribu baris data yang dapat membebani jaringan dan menyebabkan browser mengalami crash karena kehabisan memori.

Solusinya, backend menerapkan aturan downsampling otomatis: jika rentang data melebihi 7 hari, data disajikan dalam agregasi per jam; dan jika melebihi 30 hari hingga 1 tahun, data disajikan dalam agregasi harian. Dengan begitu, payload yang dikirimkan ke browser hanya berkisar 365 titik data yang ringan (di bawah 50 KB) sehingga grafik dapat dirender dengan instan.

### E.2 Autentikasi Alat vs Autentikasi Pengguna: Kenapa Dibedakan?

Pembedaan dilakukan karena perbedaan kebutuhan operasional dan karakteristik lingkungan:

Perangkat stasiun cuaca di lapangan menggunakan mikrokontroler dengan keterbatasan memori dan daya baterai. Oleh karena itu, autentikasi menggunakan API key statis yang terenkripsi sudah cukup efektif, hemat daya, dan tidak membebani proses jaringan perangkat.

Sebaliknya, pengguna manusia pada web dashboard membutuhkan sistem autentikasi interaktif (email dan password) dengan manajemen sesi, pembedaan hak akses (seperti hak edit konfigurasi untuk admin versus hak lihat untuk operator), serta kemampuan logout untuk keamanan akses.

### E.3 Desain Pembatasan Request (Rate Limiting)

Pembatasan request diterapkan per perangkat menggunakan Redis.

Perangkat stasiun dijatah batas wajar sekitar 60 request per menit. Karena perangkat normal hanya mengirim data satu kali per menit, kuota ini memberikan toleransi yang cukup untuk pengiriman ulang jika koneksi sempat terputus. Di sisi lain, request dari alamat yang tidak terdaftar akan dibatasi secara ketat untuk melindungi endpoint dari potensi serangan spam.

---

## Bagian G: Keputusan Desain Visualisasi Data (Frontend)

### G.1 Berapa Titik Data yang Wajar di Satu Grafik?

Jumlah titik data yang ideal untuk kenyamanan tampilan visual dan performa browser berkisar antara 100 hingga 300 titik data (maksimal sekitar 500 titik). Memuat ribuan titik pada satu kanvas grafik akan membuat garis tampak bertumpuk sulit dibaca dan menyebabkan interaksi kursor menjadi lambat.

Oleh karena itu, saat pengguna memilih rentang satu tahun, dashboard menyajikan sekitar 365 titik data harian. Tampilan grafik tetap informatif, tren tahunan terbaca jelas, dan performa rendering tetap responsif.

### G.2 Menampilkan Gap Data Pas Alat Offline: Garis Putus, Nol, atau Interpolasi?

Data yang hilang akibat perangkat offline sebaiknya ditampilkan menggunakan garis putus (celah kosong).

Mengisi nilai dengan angka nol tidak tepat karena pada sensor seperti suhu, nilai nol derajat memiliki arti fisik (titik beku air), bukan ketiadaan data. Jika diisi nol, grafik akan anjlok drastis dan memberikan interpretasi keliru seolah terjadi cuaca ekstrem.

Menghubungkan garis secara langsung (interpolasi) juga kurang tepat karena memberikan kesan bahwa data selalu ada secara kontinu selama perangkat offline.

Menggunakan celah kosong merupakan representasi yang paling jujur, memberikan informasi yang jelas kepada pengguna bahwa pada periode tersebut tidak ada pembacaan yang diterima, sehingga tim operasional dapat mengetahui adanya periode offline.
