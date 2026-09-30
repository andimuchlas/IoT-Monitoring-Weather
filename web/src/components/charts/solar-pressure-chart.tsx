"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { SunMedium, Gauge } from "lucide-react";
import type { TelemetryReadingPoint, TimeRange } from "../../types/reading";
import { formatChartTick, formatWIB } from "../../lib/date";

interface SolarPressureChartProps {
  data: TelemetryReadingPoint[];
  range: TimeRange;
}

export function SolarPressureChart({ data, range }: SolarPressureChartProps) {
  const stats = useMemo(() => {
    let maxSolar = 0;
    let sumPressure = 0;
    let countPressure = 0;

    data.forEach((p) => {
      if (typeof p.solar_rad === "number" && p.solar_rad > maxSolar) {
        maxSolar = p.solar_rad;
      }
      if (typeof p.pressure === "number") {
        sumPressure += p.pressure;
        countPressure++;
      }
    });

    return {
      peakSolar: maxSolar.toFixed(0),
      avgPressure: countPressure > 0 ? (sumPressure / countPressure).toFixed(1) : "-",
    };
  }, [data]);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
      {/* Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <SunMedium className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Radiasi Matahari &amp; Tekanan Barometrik
            </h3>
            <p className="text-xs text-slate-500">
              Pyranometer SP-110 (W/m²) &amp; BMP280 Barometer (hPa)
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs">
          <div className="bg-amber-50/70 border border-amber-100 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] text-amber-700 block uppercase font-medium">
              Puncak Radiasi
            </span>
            <span className="font-mono font-bold text-amber-950">{stats.peakSolar} W/m²</span>
          </div>

          <div className="bg-indigo-50/70 border border-indigo-100 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] text-indigo-700 block uppercase font-medium">
              Tekanan Rata-rata
            </span>
            <span className="font-mono font-bold text-indigo-950">{stats.avgPressure} hPa</span>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="solarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              tickFormatter={(val) => formatChartTick(val, range)}
              tick={{ fontSize: 11, fill: "#64748b" }}
            />

            {/* Left YAxis: Solar Radiation */}
            <YAxis
              yAxisId="solar"
              unit=" W"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#d97706" }}
            />

            {/* Right YAxis: Pressure */}
            <YAxis
              yAxisId="press"
              orientation="right"
              domain={["auto", "auto"]}
              unit=" hPa"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#6366f1" }}
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
                        <span className="flex items-center gap-1.5 text-amber-400">
                          <SunMedium className="w-3.5 h-3.5" /> Radiasi Matahari:
                        </span>
                        <strong className="font-mono">{reading.solar_rad ?? 0} W/m²</strong>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-indigo-400">
                          <Gauge className="w-3.5 h-3.5" /> Tekanan Barometrik:
                        </span>
                        <strong className="font-mono">{reading.pressure ?? "-"} hPa</strong>
                      </div>
                    </div>
                  </div>
                );
              }}
            />

            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: 15, fontSize: "12px" }}
              iconType="circle"
            />

            <Area
              yAxisId="solar"
              type="monotone"
              dataKey="solar_rad"
              name="Radiasi Matahari (W/m²)"
              stroke="#d97706"
              strokeWidth={2}
              fill="url(#solarGradient)"
              activeDot={{ r: 4 }}
            />

            <Line
              yAxisId="press"
              type="monotone"
              dataKey="pressure"
              name="Tekanan Udara (hPa)"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
