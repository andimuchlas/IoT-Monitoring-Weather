# Dokumentasi REST API Platform Monitoring Stasiun Cuaca (IoT)

Sistem ini menyediakan RESTful API berbasis Hono & TypeScript untuk kebutuhan penyerapan data telemetri IoT (_ingestion_), pengelolaan siklus hidup perangkat & sensor, serta penyajian data analitik time-series untuk antarmuka pengguna (_frontend dashboard_).

---

## 1. Konvensi & Standar API

### 1.1 Format Response Envelope

Semua respons API dikemas dalam format envelope JSON yang seragam:

#### Response Berhasil

```json
{
  "success": true,
  "code": "OK",
  "message": "Operasi berhasil",
  "data": { ... },
  "meta": {
    "requestId": "req-9a8b7c6d",
    "timestamp": "2026-10-01T12:00:00.000Z"
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

#### Response Error Standar

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Validasi payload gagal",
  "details": [
    {
      "field": "batch.0.ts",
      "message": "Timestamp wajib berupa angka Unix epoch detik"
    }
  ],
  "meta": {
    "requestId": "req-1a2b3c4d",
    "timestamp": "2026-10-01T12:00:00.000Z"
  }
}
```

### 1.2 Kode Status HTTP yang Digunakan

| Kode HTTP                      | Status                 | Penggunaan                                                            |
| :----------------------------- | :--------------------- | :-------------------------------------------------------------------- |
| **`200 OK`**                   | Berhasil               | Query data, detail, atau idempotent cache replay.                     |
| **`201 Created`**              | Terbuat                | Data baru berhasil disimpan (telemetry, registrasi device/sensor).    |
| **`207 Multi-Status`**         | Sebagian Sukses        | Batch ingestion di mana sebagian data diterima dan sebagian duplikat. |
| **`400 Bad Request`**          | Input Buruk            | Format JSON rusak atau semua item dalam batch gagal diproses.         |
| **`401 Unauthorized`**         | Kredensial Absen/Salah | Header `X-API-Key` atau `Authorization: Bearer <token>` tidak valid.  |
| **`403 Forbidden`**            | Akses Ditolak          | Perangkat `decommissioned` mencoba kirim data, atau user non-admin.   |
| **`404 Not Found`**            | Tidak Ditemukan        | ID device, sensor, atau rute tidak terdaftar di sistem.               |
| **`409 Conflict`**             | Konflik Unik           | Duplikasi serial number sensor atau konflik instalasi aktif.          |
| **`422 Unprocessable Entity`** | Validasi Skema Gagal   | Schema Zod mendeteksi pelanggaran tipe atau batas nilai min/max.      |
| **`429 Too Many Requests`**    | Terkena Rate Limit     | Melebihi ambang batas 120 req/menit (per device ID / IP).             |
| **`500 Internal Error`**       | Kesalahan Server       | Kesalahan internal server yang tak tertangani.                        |

### 1.3 Mekanisme Autentikasi

1. **Device Autentikasi (`Ingestion`)**:
   - Header: `X-API-Key: <plain_device_key>`
   - Diverifikasi di backend menggunakan hashing SHA-256 / Bun Password Hash yang tersimpan pada kolom `api_key_hash` di tabel `devices`.
2. **User / Operator Autentikasi (`Dashboard & Management`)**:
   - Header: `Authorization: Bearer <jwt_token>`
   - Diterbitkan melalui endpoint `POST /api/v1/auth/login` (Role: `admin`, `operator`, `viewer`).
3. **Public Read-Only Monitoring**:
   - Endpoint `GET /api/v1/dashboard/overview` dan endpoint `GET /api/v1/readings` mendukung _optional auth_ sehingga dashboard operasional publik dapat langsung menampilkan data cuaca terkini tanpa wajib login.

---

## 2. Ingestion Endpoints (Dipanggil oleh Device)

### 2.1 Single Telemetry Ingestion

- **Method**: `POST`
- **Path**: `/api/v1/ingest/telemetry`
- **Headers**:
  - `Content-Type: application/json`
  - `X-API-Key: device-secret-123`

#### Request Body

```json
{
  "device_id": "WS-GRT-001",
  "fw": "1.4.2",
  "ts": 1757308800,
  "seq": 10432,
  "battery_v": 3.92,
  "rssi": -71,
  "readings": [
    { "s": "temp_air", "v": 27.4 },
    { "s": "humidity", "v": 82.1 },
    { "s": "pressure", "v": 1008.3 },
    { "s": "wind_speed", "v": 3.2 },
    { "s": "wind_dir", "v": 217 },
    { "s": "rain_counter", "v": 1043 },
    { "s": "solar_rad", "v": 512.7 }
  ]
}
```

#### Response (201 Created - Sukses)

```json
{
  "success": true,
  "code": "INGEST_SUCCESS",
  "message": "Telemetry accepted and processed",
  "data": {
    "deviceId": "WS-GRT-001",
    "time": "2025-09-08T00:00:00.000Z",
    "processedCount": 7,
    "qualityFlags": {
      "good": 7
    }
  }
}
```

---

### 2.2 Batch Telemetry Ingestion (Data Buffered saat Offline)

- **Method**: `POST`
- **Path**: `/api/v1/ingest/telemetry/batch`
- **Headers**: `X-API-Key: <device_secret>`

#### Request Body (Maksimal 500 records)

```json
{
  "device_id": "WS-GRT-001",
  "fw": "1.4.2",
  "batch": [
    {
      "ts": 1757308800,
      "seq": 10432,
      "battery_v": 3.92,
      "rssi": -71,
      "readings": [
        { "s": "temp_air", "v": 27.4 },
        { "s": "rain_counter", "v": 1043 }
      ]
    },
    {
      "ts": 1757308860,
      "seq": 10433,
      "battery_v": 3.91,
      "rssi": -73,
      "readings": [
        { "s": "temp_air", "v": 27.6 },
        { "s": "rain_counter", "v": 1045 }
      ]
    }
  ]
}
```

#### Response Sukses Penuh (201 Created)

```json
{
  "success": true,
  "code": "INGEST_BATCH_COMPLETED",
  "message": "Batch telemetry processed: 2 accepted, 0 duplicate",
  "data": {
    "deviceId": "WS-GRT-001",
    "total": 2,
    "accepted": 2,
    "duplicates": 0,
    "failed": 0
  }
}
```

#### Response Sukses Sebagian (207 Multi-Status - Misal 8 diterima, 2 duplikat)

```json
{
  "success": true,
  "code": "INGEST_BATCH_MULTI_STATUS",
  "message": "Batch telemetry processed: 8 accepted, 2 duplicate",
  "data": {
    "deviceId": "WS-GRT-001",
    "total": 10,
    "accepted": 8,
    "duplicates": 2,
    "failed": 0,
    "items": [
      {
        "seq": 10430,
        "ts": 1757308680,
        "status": "duplicate",
        "message": "Duplicate payload in dedup window"
      },
      { "seq": 10431, "ts": 1757308740, "status": "accepted", "readingsCount": 7 }
    ]
  }
}
```

---

### 2.3 Heartbeat Ingestion

- **Method**: `POST`
- **Path**: `/api/v1/ingest/heartbeat`

#### Request Body

```json
{
  "device_id": "WS-GRT-001",
  "ts": 1757308920,
  "fw": "1.4.2",
  "battery_v": 3.9,
  "rssi": -70,
  "uptime_s": 864321
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "code": "HEARTBEAT_ACK",
  "message": "Device heartbeat recorded",
  "data": {
    "deviceId": "WS-GRT-001",
    "lastSeenAt": "2026-10-01T12:05:00.000Z",
    "batteryV": 3.9,
    "rssi": -70
  }
}
```

---

## 3. Device Management Endpoints

| Method   | Path                                      | Keterangan                                                  | Auth  |
| :------- | :---------------------------------------- | :---------------------------------------------------------- | :---- |
| `POST`   | `/api/v1/devices`                         | Pendaftaran stasiun baru                                    | Admin |
| `GET`    | `/api/v1/devices`                         | Daftar stasiun (filter: status, location_id, q; pagination) | Auth  |
| `GET`    | `/api/v1/devices/{id}`                    | Detail satu stasiun                                         | Auth  |
| `PATCH`  | `/api/v1/devices/{id}`                    | Update identitas/status stasiun                             | Admin |
| `DELETE` | `/api/v1/devices/{id}`                    | Soft delete stasiun                                         | Admin |
| `POST`   | `/api/v1/devices/{id}/credentials/rotate` | Rotasi API key perangkat                                    | Admin |
| `GET`    | `/api/v1/devices/{id}/health`             | Status kesehatan & indikator offline > X menit              | Auth  |

#### Contoh Request POST `/api/v1/devices`

```json
{
  "id": "WS-BDG-004",
  "name": "Stasiun Cuaca Dago Pakar",
  "locationId": "8b9e672f-5b12-4cf4-916c-17937b2d13a9",
  "status": "provisioned",
  "firmwareVersion": "1.4.2"
}
```

#### Response POST `/api/v1/devices` (201 Created)

```json
{
  "success": true,
  "code": "DEVICE_CREATED",
  "message": "Device berhasil didaftarkan",
  "data": {
    "device": {
      "id": "WS-BDG-004",
      "name": "Stasiun Cuaca Dago Pakar",
      "status": "provisioned"
    },
    "apiKey": "sk_live_ws_bdg_004_7f8a9b2c..."
  }
}
```

_(Catatan: API key hanya ditampilkan sekali saat dibuat atau dirotasi)._

---

## 4. Sensor Management Endpoints

| Method         | Path                                       | Keterangan                        | Auth         |
| :------------- | :----------------------------------------- | :-------------------------------- | :----------- |
| `GET/POST`     | `/api/v1/sensor-types`                     | Master data tipe sensor           | Auth / Admin |
| `GET/POST`     | `/api/v1/sensors`                          | List & buat fisik sensor baru     | Auth / Admin |
| `PATCH/DELETE` | `/api/v1/sensors/{id}`                     | Update & hapus sensor fisik       | Admin        |
| `POST`         | `/api/v1/devices/{id}/sensors`             | Pasang sensor ke stasiun tertentu | Admin        |
| `DELETE`       | `/api/v1/devices/{id}/sensors/{sensor_id}` | Lepas sensor dari stasiun         | Admin        |
| `POST`         | `/api/v1/sensors/{id}/calibrations`        | Tambah parameter kalibrasi baru   | Admin        |
| `GET`          | `/api/v1/sensors/{id}/calibrations`        | Riwayat kalibrasi sensor          | Auth         |

#### Contoh Request POST `/api/v1/sensors/{id}/calibrations`

```json
{
  "scale": 1.02,
  "offset": -0.15,
  "effectiveFrom": "2026-10-01T00:00:00Z",
  "notes": "Kalibrasi chamber tahunan lab LK-01"
}
```

---

## 5. Query Data (Konsumsi Frontend Dashboard)

### 5.1 Dashboard Overview

- **Method**: `GET`
- **Path**: `/api/v1/dashboard/overview`
- **Deskripsi**: Ringkasan stasiun, status online/offline (>15 menit), baterai, dan nilai pembacaan terakhir untuk kartu stasiun halaman beranda.

#### Response (200 OK)

```json
{
  "success": true,
  "code": "OK",
  "data": {
    "summary": {
      "totalStations": 3,
      "online": 2,
      "offline": 1,
      "maintenance": 0
    },
    "stations": [
      {
        "id": "WS-GRT-001",
        "name": "Stasiun Cuaca Lembang 01",
        "locationName": "Stasiun Lembang Puncak",
        "status": "active",
        "batteryV": 3.92,
        "rssi": -71,
        "lastSeenAt": "2026-10-01T12:00:00.000Z",
        "isOffline": false,
        "latestReadings": {
          "temp_air": 23.4,
          "humidity": 82.5,
          "pressure": 1012.3,
          "wind_speed": 2.8,
          "wind_dir": 180,
          "rain_counter": 1045,
          "solar_rad": 512.0
        }
      }
    ]
  }
}
```

---

### 5.2 Nilai Terkini Semua Sensor pada Stasiun

- **Method**: `GET`
- **Path**: `/api/v1/devices/{id}/readings/latest`

#### Response (200 OK)

```json
{
  "success": true,
  "code": "OK",
  "data": {
    "device": {
      "id": "WS-GRT-001",
      "name": "Stasiun Cuaca Lembang 01",
      "status": "active",
      "lastSeenAt": "2026-10-01T12:00:00.000Z",
      "isOffline": false
    },
    "readings": [
      {
        "sensorId": "sn-01",
        "sensorTypeId": "temp_air",
        "sensorTypeName": "Air Temperature",
        "unit": "°C",
        "value": 24.2,
        "rawValue": 24.4,
        "qualityFlag": "good",
        "time": "2026-10-01T12:00:00.000Z"
      }
    ]
  }
}
```

---

### 5.3 Time-Series Telemetry

- **Method**: `GET`
- **Path**: `/api/v1/readings`
- **Query Parameters**:
  - `device_id` (string, opsional): ID stasiun cuaca.
  - `sensor_type` (string, opsional): Tipe sensor (`temp_air`, `humidity`, dll).
  - `from` (string ISO, opsional): Rentang awal (default: 24 jam lalu).
  - `to` (string ISO, opsional): Rentang akhir (default: sekarang).
  - `interval` (`raw` | `1m` | `1h` | `1d`, default: `raw`): Resolusi bucket agregasi.
  - `agg` (`avg` | `min` | `max` | `sum`, opsional): Agregat yang dipilih.
  - `limit` (integer, default: 500).

> **Efisiensi Payload & Downsampling Paksa:**
> Jika pengguna meminta rentang waktu > 7 hari dengan interval `raw`, backend secara otomatis menerapkan _forced downsampling_ ke bucket `1h` (atau `1d` untuk rentang > 30 hari) untuk mencegah pembengkakan memori dan transfer data gigabyte ke peramban.

#### Response Time-Series Agregasi (`1h`)

```json
{
  "success": true,
  "code": "OK",
  "data": {
    "interval": "1h",
    "forcedDownsampling": false,
    "count": 24,
    "data": [
      {
        "time": "2026-10-01T11:00:00.000Z",
        "deviceId": "WS-GRT-001",
        "sensorTypeId": "temp_air",
        "value": 24.5,
        "avg": 24.5,
        "min": 22.1,
        "max": 27.8,
        "sum": 1470.0,
        "readingCount": 60
      }
    ]
  }
}
```

---

### 5.4 Summary Harian

- **Method**: `GET`
- **Path**: `/api/v1/readings/summary`
- **Query Parameters**: `device_id`, `from`, `to`
- **Deskripsi**: Menyajikan ringkasan suhu (min/max/avg), total curah hujan (mm), dan kecepatan angin maksimum.

#### Response (200 OK)

```json
{
  "success": true,
  "code": "OK",
  "data": {
    "range": {
      "from": "2026-09-30T12:00:00.000Z",
      "to": "2026-10-01T12:00:00.000Z"
    },
    "temperature": {
      "min": 19.8,
      "max": 28.4,
      "avg": 24.1,
      "count": 1440
    },
    "humidity": {
      "min": 55.0,
      "max": 96.0,
      "avg": 81.2,
      "count": 1440
    },
    "pressure": {
      "min": 1007.5,
      "max": 1013.2,
      "avg": 1010.4,
      "count": 1440
    },
    "windSpeed": {
      "summary": { "min": 0.5, "max": 8.4, "avg": 3.1, "count": 1440 },
      "max": 8.4
    },
    "rainfall": {
      "totalMm": 18.4,
      "readingsCount": 1440
    }
  }
}
```
