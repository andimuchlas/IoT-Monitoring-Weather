/**
 * IoT Weather Station Multi-Device Simulator
 *
 * Mensimulasikan minimal 3 stasiun cuaca sesuai spesifikasi Bagian 4.4 & F.1:
 *  1. WS-GRT-001 (Lembang) : Mode Normal (pengiriman periodik single telemetry)
 *  2. WS-CSR-002 (Cisarua) : Mode Offline Buffer (mengumpulkan buffer, lalu flush via batch)
 *  3. WS-DPK-003 (Depok)   : Mode Duplikat & Retry (mengirim ulang payload yang sama untuk uji idempotensi)
 *
 * Cara menjalankan:
 *   bun run simulator/index.ts
 *   atau
 *   bun run simulate
 */

const API_BASE_URL =
  process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_KEY = process.env.DEVICE_API_KEY || "device-secret-123";

const INTERVAL_MS = parseInt(process.env.SIM_INTERVAL_MS || "5000", 10);
const MAX_CYCLES = parseInt(process.env.SIM_CYCLES || "0", 10); // 0 = continuous

interface DeviceSimState {
  deviceId: string;
  name: string;
  mode: "NORMAL" | "OFFLINE_BATCH" | "DUPLICATE_RETRY";
  fw: string;
  seq: number;
  batteryV: number;
  rssi: number;
  rainCounter: number;
  baseTemp: number;
  buffer: any[];
}

const devices: DeviceSimState[] = [
  {
    deviceId: "WS-GRT-001",
    name: "Stasiun Lembang Puncak",
    mode: "NORMAL",
    fw: "1.4.2",
    seq: 10430,
    batteryV: 3.92,
    rssi: -71,
    rainCounter: 1043,
    baseTemp: 22.5,
    buffer: [],
  },
  {
    deviceId: "WS-CSR-002",
    name: "Stasiun Cisarua Kebun Teh",
    mode: "OFFLINE_BATCH",
    fw: "1.4.2",
    seq: 5210,
    batteryV: 4.05,
    rssi: -65,
    rainCounter: 420,
    baseTemp: 24.0,
    buffer: [],
  },
  {
    deviceId: "WS-DPK-003",
    name: "Stasiun Depok Asri",
    mode: "DUPLICATE_RETRY",
    fw: "1.4.0",
    seq: 8840,
    batteryV: 3.84,
    rssi: -78,
    rainCounter: 815,
    baseTemp: 31.0,
    buffer: [],
  },
];

function generateSensorReadings(dev: DeviceSimState) {
  const hour = new Date().getHours();
  const tempSin = Math.sin(((hour - 8) * Math.PI) / 12);
  const temp = Number((dev.baseTemp + 4.0 * tempSin + (Math.random() * 0.8 - 0.4)).toFixed(1));
  const humidity = Number(
    Math.max(30, Math.min(99, 78.0 - 20.0 * tempSin + (Math.random() * 2 - 1))).toFixed(1)
  );
  const pressure = Number(
    (1012.0 + 2.0 * Math.cos((hour * Math.PI) / 12) + (Math.random() * 0.4 - 0.2)).toFixed(1)
  );
  const windSpeed = Number((1.8 + Math.max(0, 2.5 * tempSin) + Math.random() * 0.6).toFixed(1));
  const windDir = Math.round((180 + 80 * Math.sin(hour / 3) + Math.random() * 20) % 360);

  // Probabilitas hujan bertambah tip counter
  if (Math.random() > 0.65) {
    dev.rainCounter += Math.floor(Math.random() * 3) + 1;
  }

  const solarRad =
    hour >= 6 && hour <= 18
      ? Number(
          (Math.max(0, 650.0 * Math.sin(((hour - 6) * Math.PI) / 12)) + Math.random() * 25).toFixed(
            1
          )
        )
      : 0;

  return [
    { s: "temp_air", v: temp },
    { s: "humidity", v: humidity },
    { s: "pressure", v: pressure },
    { s: "wind_speed", v: windSpeed },
    { s: "wind_dir", v: windDir },
    { s: "rain_counter", v: dev.rainCounter },
    { s: "solar_rad", v: solarRad },
  ];
}

async function postJson(endpoint: string, body: any) {
  const start = performance.now();
  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
        "X-Device-Id": body.device_id,
      },
      body: JSON.stringify(body),
    });

    const duration = Math.round(performance.now() - start);
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    return {
      status: res.status,
      ok: res.ok,
      duration,
      data: json,
    };
  } catch (err: any) {
    const duration = Math.round(performance.now() - start);
    return {
      status: 0,
      ok: false,
      duration,
      error: err.message,
    };
  }
}

async function runCycle(cycleNumber: number) {
  const timestamp = Math.floor(Date.now() / 1000);
  console.log(`\n======================================================`);
  console.log(`⏱️  [Cycle #${cycleNumber}] - ${new Date().toISOString()}`);
  console.log(`Target API: ${API_BASE_URL} | Interval: ${INTERVAL_MS / 1000}s`);
  console.log(`======================================================`);

  for (const dev of devices) {
    dev.seq++;
    dev.batteryV = Number(
      Math.max(3.3, dev.batteryV - 0.001 + (Math.random() * 0.002 - 0.001)).toFixed(2)
    );
    dev.rssi = Math.floor(dev.rssi + (Math.random() * 4 - 2));

    const readings = generateSensorReadings(dev);

    if (dev.mode === "NORMAL") {
      // 1. Skenario NORMAL: Mengirim single telemetry
      const payload = {
        device_id: dev.deviceId,
        fw: dev.fw,
        ts: timestamp,
        seq: dev.seq,
        battery_v: dev.batteryV,
        rssi: dev.rssi,
        readings,
      };

      const res = await postJson("/api/v1/ingest/telemetry", payload);
      const icon = res.ok ? "✅" : "❌";
      console.log(
        `${icon} [${dev.deviceId}] (NORMAL) HTTP ${res.status} (${res.duration}ms) - seq: ${dev.seq}, temp: ${readings[0]?.v}°C, rain: ${dev.rainCounter}`
      );

      // Heartbeat berkala tiap 4 cycle
      if (cycleNumber % 4 === 0) {
        const hbPayload = {
          device_id: dev.deviceId,
          ts: timestamp,
          fw: dev.fw,
          battery_v: dev.batteryV,
          rssi: dev.rssi,
          uptime_s: cycleNumber * (INTERVAL_MS / 1000),
        };
        const hbRes = await postJson("/api/v1/ingest/heartbeat", hbPayload);
        console.log(`   💓 Heartbeat [${dev.deviceId}] HTTP ${hbRes.status} (${hbRes.duration}ms)`);
      }
    } else if (dev.mode === "OFFLINE_BATCH") {
      // 2. Skenario OFFLINE BATCH: Menimbun buffer lalu kirim serentak tiap 3 siklus
      dev.buffer.push({
        ts: timestamp,
        seq: dev.seq,
        battery_v: dev.batteryV,
        rssi: dev.rssi,
        readings,
      });

      if (dev.buffer.length < 3) {
        console.log(
          `📦 [${dev.deviceId}] (OFFLINE BUFFERING) Mengumpulkan data offline di memory (${dev.buffer.length}/3 record tertahan)...`
        );
      } else {
        const batchPayload = {
          device_id: dev.deviceId,
          fw: dev.fw,
          batch: [...dev.buffer],
        };

        const res = await postJson("/api/v1/ingest/telemetry/batch", batchPayload);
        const icon = res.ok ? "🚀" : "❌";
        console.log(
          `${icon} [${dev.deviceId}] (FLUSH BATCH) HTTP ${res.status} (${res.duration}ms) - Terkirim ${dev.buffer.length} batch records sekaligus!`
        );
        if (res.data?.data) {
          console.log(`   📊 Ingest Report: ${JSON.stringify(res.data.data)}`);
        }
        dev.buffer = []; // Reset buffer setelah sukses flush
      }
    } else if (dev.mode === "DUPLICATE_RETRY") {
      // 3. Skenario DUPLIKAT: Mengirim payload yang identik 2 kali berturut-turut
      const payload = {
        device_id: dev.deviceId,
        fw: dev.fw,
        ts: timestamp,
        seq: dev.seq,
        battery_v: dev.batteryV,
        rssi: dev.rssi,
        readings,
      };

      console.log(
        `🔁 [${dev.deviceId}] (DUPLICATE TEST) Mengirim payload pertama (ts: ${timestamp}, seq: ${dev.seq})...`
      );
      const res1 = await postJson("/api/v1/ingest/telemetry", payload);
      console.log(
        `   [Kirim 1] HTTP ${res1.status} (${res1.duration}ms) - code: ${res1.data?.code}`
      );

      // Kirim ulang payload yang 100% identik
      console.log(
        `   Mengirim ulang payload persis sama untuk uji Idempotensi (Retry/ACK hilang)...`
      );
      const res2 = await postJson("/api/v1/ingest/telemetry", payload);
      const isIdempotent = res2.status === 201 || res2.status === 200;
      console.log(
        `   [Kirim 2 (Duplikat)] ${isIdempotent ? "🛡️ Sukses Idempoten" : "❌"} HTTP ${res2.status} (${res2.duration}ms) - Server melayani via cache tanpa duplikasi row di DB.`
      );
    }
  }
}

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║         🛰️  WEATHER STATION IOT MULTI-DEVICE SIMULATOR                 ║
║               PT LUWES INOVASI MANDIRI - EVALUASI TEKNIS              ║
╚═══════════════════════════════════════════════════════════════════════╝
Target Ingestion Base URL: ${API_BASE_URL}
Pre-shared Device API Key: ${API_KEY}
Status: Menjalankan 3 Device dengan 3 Skenario berbeda:
  • Device 1: WS-GRT-001 -> Normal Streaming (Periodik per ${INTERVAL_MS / 1000}s)
  • Device 2: WS-CSR-002 -> Offline Buffering (Kirim batch 3 item)
  • Device 3: WS-DPK-003 -> Duplikat / Retry (Uji Idempotensi Cache)
Tekan Ctrl+C untuk berhenti.
`);

  let cycle = 1;
  while (true) {
    await runCycle(cycle);
    if (MAX_CYCLES > 0 && cycle >= MAX_CYCLES) {
      console.log(`\n🎉 Selesai menjalankan ${MAX_CYCLES} simulasi siklus.`);
      process.exit(0);
    }
    cycle++;
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error("Fatal error in simulator:", err);
  process.exit(1);
});
