"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Wind, Compass, Navigation } from "lucide-react";
import type { TelemetryReadingPoint, TimeRange } from "../../types/reading";
import { formatChartTick, formatWIB } from "../../lib/date";

interface WindChartProps {
  data: TelemetryReadingPoint[];
  range: TimeRange;
}

export function degToCardinal(deg?: number | null): string {
  if (deg === undefined || deg === null) return "-";
  const directions = ["U", "TL", "T", "TG", "S", "BD", "B", "BL"];
  const index = Math.round((deg % 360) / 45) % 8;
  return directions[index];
}

export function degToCompassName(deg?: number | null): string {
  if (deg === undefined || deg === null) return "-";
  const fullNames: Record<string, string> = {
    U: "Utara",
    TL: "Timur Laut",
    T: "Timur",
    TG: "Tenggara",
    S: "Selatan",
    BD: "Barat Daya",
    B: "Barat",
    BL: "Barat Laut",
  };
  const card = degToCardinal(deg);
  return `${fullNames[card] || card} (${Math.round(deg)}°)`;
}

export function WindChart({ data, range }: WindChartProps) {
  const windStats = useMemo(() => {
    let sumSpeed = 0;
    let maxSpeed = 0;
    let count = 0;

    data.forEach((p) => {
      if (typeof p.wind_speed === "number") {
        sumSpeed += p.wind_speed;
        if (p.wind_speed > maxSpeed) maxSpeed = p.wind_speed;
        count++;
      }
    });

    const latest = data.length > 0 ? data[data.length - 1] : null;

    return {
      avgSpeed: count > 0 ? (sumSpeed / count).toFixed(1) : "-",
      maxSpeed: count > 0 ? maxSpeed.toFixed(1) : "-",
      currentSpeed: latest?.wind_speed ?? "-",
      currentDir: latest?.wind_dir ?? 0,
      currentCompass: degToCompassName(latest?.wind_dir),
    };
  }, [data]);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
      {/* Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
            <Wind className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Kecepatan &amp; Vektor Arah Angin
            </h3>
            <p className="text-xs text-slate-500">Anemometer Davis &amp; Wind Vane 360°</p>
          </div>
        </div>

        {/* Stats & Current Direction Compass */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2 bg-teal-50/70 border border-teal-100 px-3 py-1.5 rounded-xl">
            <Navigation
              className="w-4 h-4 text-teal-600 transition-transform duration-500"
              style={{ transform: `rotate(${windStats.currentDir}deg)` }}
            />
            <div>
              <span className="text-[10px] text-teal-700 block uppercase font-medium">
                Arah Terkini
              </span>
              <span className="font-mono font-bold text-teal-950">{windStats.currentCompass}</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] text-slate-500 block uppercase font-medium">
              Kecepatan Rata-rata
            </span>
            <span className="font-mono font-bold text-slate-800">{windStats.avgSpeed} m/s</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] text-slate-500 block uppercase font-medium">
              Peak Gust (Maks)
            </span>
            <span className="font-mono font-bold text-rose-600">{windStats.maxSpeed} m/s</span>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              tickFormatter={(val) => formatChartTick(val, range)}
              tick={{ fontSize: 11, fill: "#64748b" }}
            />

            <YAxis
              unit=" m/s"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#64748b" }}
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const reading = payload[0].payload as TelemetryReadingPoint;
                return (
                  <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-800 text-xs">
                    <p className="text-slate-400 font-mono text-[11px] mb-2">{formatWIB(label)}</p>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-teal-400">
                          <Wind className="w-3.5 h-3.5" /> Kecepatan:
                        </span>
                        <strong className="font-mono">{reading.wind_speed ?? "-"} m/s</strong>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-slate-300">
                          <Compass className="w-3.5 h-3.5" /> Arah:
                        </span>
                        <span className="font-mono">{degToCompassName(reading.wind_dir)}</span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />

            <Line
              type="monotone"
              dataKey="wind_speed"
              name="Kecepatan Angin (m/s)"
              stroke="#0d9488"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 1, stroke: "#ffffff" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
