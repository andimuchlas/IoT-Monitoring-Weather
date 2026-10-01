# Platform Monitoring Stasiun Cuaca IoT

Platform pemantauan telemetri stasiun cuaca berbasis Internet of Things (IoT) yang dirancang untuk menerima, memvalidasi, mengalibrasi, menyimpan, mengagregasi, dan memvisualisasikan data sensor cuaca secara real-time dan andal.

---

## Daftar Isi

1. [Ikhtisar Arsitektur](#ikhtisar-arsitektur)
2. [Prasyarat Sistem](#prasyarat-sistem)
3. [Panduan Instalasi dan Menjalankan Sistem](#panduan-instalasi-dan-menjalankan-sistem)
   - [Opsi 1: Menjalankan Menggunakan Docker Compose (Direkomendasikan)](#opsi-1-menjalankan-menggunakan-docker-compose-direkomendasikan)
   - [Opsi 2: Menjalankan Lokal Menggunakan Runtime Bun](#opsi-2-menjalankan-lokal-menggunakan-runtime-bun)
4. [Daftar Perintah Bun (Command Reference)](#daftar-perintah-bun-command-reference)
5. [Menjalankan Pengujian (Testing)](#menjalankan-pengujian-testing)
6. [Menjalankan Simulator Perangkat](#menjalankan-simulator-perangkat)
7. [Daftar Endpoint dan Kredensial Default](#daftar-endpoint-dan-kredensial-default)
8. [Keputusan Desain dan Trade-off](#keputusan-desain-dan-trade-off)
9. [Asumsi Teknis](#asumsi-teknis)
10. [Item yang Belum Selesai dan Rencana Pengembangan](#item-yang-belum-selesai-dan-rencana-pengembangan)
11. [Estimasi Waktu Pengerjaan](#estimasi-waktu-pengerjaan)

---

## Ikhtisar Arsitektur

Sistem dibangun dengan arsitektur decoupled berbasis micro-service/modular monolith yang memisahkan beban kerja I/O ingestion, pengolahan latar belakang (worker), dan visualisasi frontend:

```text
[ Sensor Fisik / Simulator ]
         |
         | (HTTP POST / API Key SHA-256)
         v
+-------------------------------------------------------------+
| Backend Ingestion API (Bun + Hono)                          |
| - Autentikasi Device via Header X-API-Key                   |
| - Idempotency Guard (Redis SETNX / Expiry 24h)              |
| - Validasi Schema Zod & Out-of-Range Guard                  |
| - Normalisasi Kalibrasi (Scale & Offset)                    |
| - Penandaan Quality Flag (VALID, SENSOR_ERROR, RESET, dll.) |
+-------------------------------------------------------------+
         |                                           |
         | (Append-Only Insert)                      | (Queue Job / Cache)
         v                                           v
+-------------------------------+           +-----------------------------+
| PostgreSQL                    |           | Redis 7                     |
| - Table: sensor_readings      |           | - Idempotency Cache         |
| - Table: reading_aggregates   |           | - BullMQ Job Queue          |
| - Table: devices & sensors    |<----------| - Distributed Scheduler     |
+-------------------------------+           +-----------------------------+
         ^                                           |
         | (Query Agregat)                           | (Proses Tiap Menit)
         |                                           v
+-------------------------------+           +-----------------------------+
| Next.js Frontend Dashboard    |           | Background Rollup Worker    |
| - Recharts Dual-Axis Charts   |           | (BullMQ + Math Vector)      |
| - Downsampling Raw/1h/1d      |           | - Min, Max, Avg, Sum, Count |
| - Status Online/Offline       |           | - Mean Vector Angin (atan2) |
+-------------------------------+           +-----------------------------+
```

### Komponen Utama:

1. **Ingestion API (`api/`)**:
   - Runtime: Bun v1.3+
   - Framework: Hono v4 (ringan, performa throughput tinggi, zero-overhead routing)
   - ORM: Drizzle ORM + PostgreSQL Driver
   - Keamanan: SHA-256 Pre-shared API Key verification untuk perangkat, JWT Bearer untuk manajemen pengguna/admin.

2. **Database Engine (`db`)**:
   - Engine: PostgreSQL 18
   - Model Data Time-Series: Narrow/Long format pada tabel `sensor_readings` dengan composite index `(device_id, sensor_type_id, time DESC)`.
   - Agregasi Pre-calculated: Tabel `reading_aggregates` untuk query visualisasi jangka panjang (7 hari / 30 hari).

3. **Cache & Worker Rollup (`worker/` & `redis`)**:
   - Antrean & Scheduler: Redis 7 + BullMQ
   - Fungsi Worker: Mengagregasi data mentah ke bucket 1 jam dan 1 hari secara asynchronous, menghitung rata-rata arah angin menggunakan dekomposisi vektor trigonometri `atan2(sum(sin), sum(cos))`.

4. **Frontend Dashboard (`web/`)**:
   - Framework: Next.js 16 (App Router + Turbopack)
   - Styling: Tailwind CSS v4
   - Visualisasi: Recharts (Line Chart, Dual-Axis, Bar Chart curah hujan, Compass Wind)
   - Format Jam: Konversi terpusat ke Waktu Indonesia Barat (WIB / UTC+7).

---

## Prasyarat Sistem

Sebelum menjalankan proyek, pastikan perangkat Anda memiliki:

- **Docker** (v24.0+) dan **Docker Compose** (v2.20+)
- ATAU jika menjalankan tanpa Docker:
  - **Bun** (v1.1.0 atau lebih baru)
  - **PostgreSQL** (v15 atau lebih baru)
  - **Redis** (v7 atau lebih baru)

---

## Panduan Instalasi dan Menjalankan Sistem

### Opsi 1: Menjalankan Menggunakan Docker Compose (Direkomendasikan)

Seluruh stack (Database, Redis, API Ingestion, Worker BullMQ, dan Frontend Dashboard) dapat dijalankan dalam 1 langkah:

1. Salin konfigurasi environment:

   ```bash
   cp .env.example .env
   ```

2. Jalankan docker compose:

   ```bash
   docker compose up --build -d
   ```

3. Periksa status kontainer:

   ```bash
   docker compose ps
   ```

   Kontainer yang aktif:
   - `iot_db`: PostgreSQL 18 (Port 5432)
   - `iot_redis`: Redis 7 Alpine (Port 6379)
   - `iot_api`: Hono API Engine (Port 3001, otomatis migrasi & seed data 7 hari)
   - `iot_worker`: BullMQ Background Worker
   - `iot_web`: Next.js Dashboard (Port 3000)

4. Akses antarmuka:
   - Web Dashboard: http://localhost:3000
   - Healthcheck API: http://localhost:3001/healthz
   - Dashboard API Overview: http://localhost:3001/api/v1/dashboard/overview

5. Mematikan kontainer:
   ```bash
   docker compose down
   ```

---

### Opsi 2: Menjalankan Lokal Menggunakan Runtime Bun

Jika ingin menjalankan aplikasi langsung pada host machine untuk kebutuhan development:

1. Pasang dependensi di root project:

   ```bash
   bun install
   ```

2. Salin dan sesuaikan file environment:

   ```bash
   cp .env.example .env
   ```

   Pastikan variabel `DATABASE_URL` dan `REDIS_HOST` mengarah ke instance database dan Redis lokal Anda.

3. Jalankan migrasi database Drizzle:

   ```bash
   bun run db:migrate
   ```

4. Jalankan seeder database:

   ```bash
   bun run db:seed
   ```

   Perintah ini akan membuat:
   - Akun admin default
   - Master data 7 tipe sensor
   - 3 stasiun cuaca (`WS-GRT-001`, `WS-CSR-002`, `WS-DPK-003`)
   - Sensor fisik, instalasi, dan kalibrasi
   - Data historis 7 hari time-series

5. Jalankan Backend API:

   ```bash
   bun run dev:api
   ```

   Server API akan berjalan di http://localhost:3001 dengan fitur hot-reload.

6. Jalankan Background Worker Rollup (pada terminal terpisah):

   ```bash
   bun run worker:rollup
   ```

7. Jalankan Frontend Web (pada terminal terpisah):
   ```bash
   bun run dev:web
   ```
   Aplikasi web akan berjalan di http://localhost:3000.

---

## Daftar Perintah Bun (Command Reference)

Berikut adalah daftar lengkap perintah CLI berbasis Bun yang tersedia di root repository:

| Perintah                | Deskripsi Fungsi                                                   | Direktori Target |
| ----------------------- | ------------------------------------------------------------------ | ---------------- |
| `bun run dev:api`       | Menjalankan server backend API dalam mode development (hot-reload) | `api/`           |
| `bun run dev:web`       | Menjalankan server frontend Next.js dalam mode development         | `web/`           |
| `bun run test:api`      | Menjalankan seluruh test suite unit & integration backend          | `api/`           |
| `bun run worker:rollup` | Menjalankan worker BullMQ untuk agregasi data berkala              | `api/`           |
| `bun run simulate`      | Menjalankan simulator pengiriman data telemetri 3 stasiun          | `simulator/`     |
| `bun run db:generate`   | Menghasilkan file migrasi SQL baru dari schema Drizzle ORM         | `api/`           |
| `bun run db:migrate`    | Menerapkan seluruh migrasi database yang belum dieksekusi          | `api/`           |
| `bun run db:seed`       | Menjalankan seeder master data dan 7 hari data historis            | `api/`           |
| `bun run db:push`       | Melakukan push skema langsung ke database (skenario prototyping)   | `api/`           |
| `bun run db:studio`     | Membuka antarmuka Drizzle Studio berbasis web untuk inspeksi DB    | `api/`           |
| `bun run format`        | Melakukan format otomatis seluruh kode sumber dengan Prettier      | Root             |
| `bun run format:check`  | Memeriksa kepatuhan format kode tanpa mengubah file                | Root             |

Perintah build dan lint frontend:

- Masuk ke direktori web: `cd web`
- Linter ESLint: `bun run lint`
- Build produksi Next.js: `bun run build`

---

## Menjalankan Pengujian (Testing)

Suite pengujian mencakup 62 test case otomatis yang menguji seluruh logika kritis sesuai kriteria teknis Bagian 4.5 dan kasus edge-case Bagian F.3:

Jalankan perintah berikut:

```bash
bun run test:api
```

Atau masuk ke folder API:

```bash
cd api && bun test
```

### Cakupan Pengujian:

1. **Validasi Skema & Payload Ingestion**: Format single, batch limit (maksimal 500 item), heartbeat, dan penolakan payload tanpa mandatory field.
2. **Autentikasi & Otorisasi Kredensial**: Verifikasi SHA-256 pre-shared API Key, status device decommissioned (403), device tidak terdaftar (404), dan RBAC admin.
3. **Idempotensi & Deduplikasi**: Pengujian pengiriman payload identik 3x menghasilkan respons idempotent tanpa duplikasi baris database.
4. **Kalibrasi & Quality Flags**:
   - Timestamp masa depan (> 5 menit) ditandai flag `future_timestamp`.
   - Kode error sensor (-999) ditandai flag `sensor_error`.
   - Nilai di luar rentang wajar (contoh: kelembaban 150%) ditandai flag `out_of_range`.
   - Sensor opsional yang tidak dikirim di payload (misal `solar_rad`) diterima secara graceful.
5. **Kalkulasi Curah Hujan (Tipping Bucket Reset)**:
   - Pengujian reset counter dari 1043 ke 5 (saat reboot) tidak menghasilkan nilai negatif dan menghitung mm dengan tepat (delta tips * 0.2 mm).
6. **Worker Rollup BullMQ**:
   - Pengujian kalkulasi metrik min, max, avg, sum, count.
   - Pengujian perhitungan rata-rata arah angin menggunakan dekomposisi vektor sudut trigonometri (contoh: 350 derajat dan 10 derajat menghasilkan 0/360 derajat, bukan 180 derajat).

---

## Menjalankan Simulator Perangkat

Simulator perangkat realistis disediakan di folder `simulator/index.ts`. Simulator ini mengirimkan paket telemetri HTTP secara berkala untuk 3 skenario:

1. **`WS-GRT-001` (Stasiun Normal)**: Mengirim paket telemetri reguler setiap 10 detik dengan variasi acak natural.
2. **`WS-CSR-002` (Stasiun Offline Batch)**: Mensimulasikan kondisi stasiun yang sempat terputus jaringan selama 1 jam, kemudian mengirimkan burst payload batch buffered (10 paket sekaligus) lengkap dengan deteksi reset rain counter.
3. **`WS-DPK-003` (Stasiun Uji Idempotensi / Retry)**: Mengirimkan paket telemetri dengan payload dan timestamp yang sama sebanyak 2-3 kali untuk menguji respon deduplikasi idempotensi server.

Jalankan simulator dengan perintah:

```bash
bun run simulate
```

---

## Daftar Endpoint dan Kredensial Default

### Endpoint Utama

| Method  | Endpoint                         | Fungsi                                                    | Autentikasi        |
| ------- | -------------------------------- | --------------------------------------------------------- | ------------------ |
| `POST`  | `/api/v1/ingest/telemetry`       | Penerimaan data telemetri tunggal dari perangkat          | Header `X-API-Key` |
| `POST`  | `/api/v1/ingest/telemetry/batch` | Penerimaan data telemetri batch (buffer offline, max 500) | Header `X-API-Key` |
| `POST`  | `/api/v1/ingest/heartbeat`       | Pembaruan status kesehatan perangkat tanpa telemetri      | Header `X-API-Key` |
| `GET`   | `/api/v1/dashboard/overview`     | Ringkasan status seluruh stasiun untuk overview           | Publik / Opsional  |
| `GET`   | `/api/v1/devices/:id`            | Detail metadata dan pembacaan terkini satu stasiun        | Publik / Opsional  |
| `GET`   | `/api/v1/readings`               | Time-series data telemetri (raw / downsampled 1h/1d)      | Publik / Opsional  |
| `GET`   | `/api/v1/readings/summary`       | Metrik ringkasan 24 jam stasiun cuaca                     | Publik / Opsional  |
| `POST`  | `/api/v1/devices`                | Pendaftaran stasiun cuaca baru                            | Bearer JWT (Admin) |
| `PATCH` | `/api/v1/devices/:id`            | Pembaruan status dan metadata stasiun                     | Bearer JWT (Admin) |
| `POST`  | `/api/v1/devices/:id/sensors`    | Pemasangan sensor baru ke stasiun cuaca                   | Bearer JWT (Admin) |

Dokumentasi lengkap format skema JSON request dan response dapat dilihat pada [API.md](file:///home/andim/learn/iot/API.md).

### Kredensial Bawaan Seeder

- **Device API Key (Pre-shared)**: `device-secret-123`
- **Admin User**:
  - Email: `admin@weather.iot`
  - Password: `AdminPassword123!`

---

## Keputusan Desain dan Trade-off

1. **Model Penyimpanan Append-Only pada Time-Series**:
   - _Keputusan_: Tabel `sensor_readings` bersifat strictly append-only (tidak pernah ada operasi `UPDATE`).
   - _Alasan_: Menghindari row-locking, fragmentasi disk (table bloat di PostgreSQL akibat MVCC), serta memastikan integritas audit data iklim historis.

2. **Format Narrow/Long vs Wide**:
   - _Keputusan_: Format Narrow/Long pada database (`id`, `device_id`, `sensor_type_id`, `time`, `raw_value`, `value`, `quality_flag`), namun otomatis di-pivot menjadi format Wide pada endpoint API untuk kebutuhan grafik chart frontend.
   - _Trade-off_: Format Narrow memerlukan baris lebih banyak (~184 juta baris per tahun untuk 50 stasiun), tetapi memberikan fleksibilitas penuh di mana penambahan tipe sensor baru tidak membutuhkan migrasi DDL `ALTER TABLE`.

3. **Agregasi Asynchronous Berkelanjutan (BullMQ) vs Continuous Aggregates**:
   - _Keputusan_: Menggunakan BullMQ worker untuk downsampling berkala ke tabel `reading_aggregates`.
   - _Alasan_: Memberikan kompatibilitas penuh pada PostgreSQL vanilla tanpa dependensi ekstensi proprietary luar, sekaligus memisahkan beban komputasi analitik berat dari request ingestion HTTP.

4. **Kalkulasi Vektor Trigonometri untuk Arah Angin**:
   - _Keputusan_: Tidak menggunakan rata-rata aritmatika biasa untuk arah angin (0 - 360 derajat).
   - _Implementasi_: Mengubah setiap derajat ke radian, menghitung vektor komponen sumbu X (`cos`) dan Y (`sin`), kemudian mengembalikan derajat rata-rata menggunakan fungsi `atan2(sum_sin, sum_cos)`.

5. **Pemisahan Autentikasi Publik dan Manajemen**:
   - _Keputusan_: Endpoint pemantauan baca (`GET /dashboard/overview`, `GET /devices/:id`, `GET /readings`) menggunakan middleware `optionalAuth`, sedangkan operasi mutasi data dan pendaftaran perangkat mewajibkan `requireAdmin`.
   - _Alasan_: Memungkinkan dashboard publik dan layar display stasiun memantau cuaca tanpa hambatan token kedaluwarsa, namun sistem tetap terlindungi dari manipulasi data tidak sah.

---

## Asumsi Teknis

1. **Clock Drift Toleransi**:
   - Timestamp dari perangkat yang terpaut lebih dari 5 menit ke masa depan dibandingkan server waktu HTTP diberi flag `future_timestamp` dan disimpan, bukan ditolak mentah-mentah.
2. **Karakteristik Tipping Bucket Rain Counter**:
   - Counter hujan berupa pulsa naik bertahap (1 tip = 0.2 mm).
   - Jika nilai counter saat ini lebih rendah dari counter sebelumnya, sistem mengasumsikan stasiun mengalami restart atau reboot daya, sehingga curah hujan dihitung murni dari nilai counter baru tanpa menghasilkan nilai negatif.
3. **Timezone Representation**:
   - Semua tanggal dan waktu disimpan dalam format UTC (`TIMESTAMPTZ`) pada database PostgreSQL.
   - Konversi ke Waktu Indonesia Barat (WIB / UTC+7) ditangani di lapisan antarmuka pengguna (Frontend) menggunakan modul format terpusat.
4. **Batas Rentang Downsampling**:
   - Permintaan grafik dengan rentang waktu lebih dari 7 hari otomatis dialihkan ke agregat interval `1h`.
   - Permintaan grafik dengan rentang waktu lebih dari 30 hari otomatis dialihkan ke agregat interval `1d`.

---

## Item yang Belum Selesai dan Rencana Pengembangan

1. **Protokol Transport MQTT & CoAP**:
   - _Kondisi saat ini_: Ingestion berjalan melalui REST HTTP.
   - _Rencana penyelesaian_: Menambahkan MQTT broker (Aedes/Mosquitto) dengan consumer worker untuk mengakomodasi stasiun di wilayah terpencil dengan bandwidth seluler 2G/GPRS yang sangat terbatas.
2. **Sistem Notifikasi Peringatan Dini (Alert Engine)**:
   - _Kondisi saat ini_: Kriteria ambang batas hujan terdeteksi di level kalkulasi worker.
   - _Rencana penyelesaian_: Mengintegrasikan modul webhook dan Telegram bot notification dispatcher saat curah hujan melebihi ambang batas darurat (> 20 mm/jam).
3. **Partitioning Native Bulanan PostgreSQL**:
   - _Kondisi saat ini_: Drizzle schema menggunakan single table dengan index B-Tree komposit.
   - _Rencana penyelesaian_: Mengonfigurasi deklarasi `PARTITION BY RANGE (time)` per bulan untuk mempermudah drop partisi data lama sesuai aturan retensi data.

---

## Estimasi Waktu Pengerjaan

Total waktu yang dihabiskan untuk implementasi proyek ini adalah sekitar **18 jam kerja terfokus**, dengan rincian alokasi sebagai berikut:

- Perancangan Arsitektur, ERD, dan Skema Database (Drizzle ORM): 3 jam
- Backend Ingestion API, Validasi Zod, dan Edge Cases F.3: 4 jam
- Implementasi Background Rollup Worker BullMQ & Vektor Trigonometri: 2.5 jam
- Pembuatan Unit & Integration Tests (62 tests): 2.5 jam
- Pembuatan Simulator Perangkat Realistis (3 stasiun): 1.5 jam
- Integrasi Frontend Next.js Dashboard, Recharts, dan Refaktor Live Data: 3 jam
- Dokumentasi Teknis (`API.md`, `README.md`, `JAWABAN.md`, `data-flow.md`): 1.5 jam
