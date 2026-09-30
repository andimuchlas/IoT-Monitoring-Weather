"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { CloudRain, Droplet, Umbrella } from "lucide-react";
import type { TelemetryReadingPoint, TimeRange } from "../../types/reading";
import { formatChartTick, formatWIB } from "../../lib/date";

interface RainfallChartProps {
  data: TelemetryReadingPoint[];
  range: TimeRange;
}

export function RainfallChart({ data, range }: RainfallChartProps) {
  const rainStats = useMemo(() => {
    let totalMm = 0;
    let maxMm = 0;
    let rainyPeriods = 0;

    data.forEach((p) => {
      const val = p.rainfall_mm || 0;
      totalMm += val;
      if (val > maxMm) maxMm = val;
      if (val > 0) rainyPeriods++;
    });

    const latestCounter = data.length > 0 ? (data[data.length - 1].rain_counter ?? "-") : "-";

    return {
      total: totalMm.toFixed(1),
      max: maxMm.toFixed(1),
      rainyPeriods,
      latestCounter,
    };
  }, [data]);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
      {/* Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
            <CloudRain className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Presipitasi / Curah Hujan (Rainfall)
            </h3>
            <p className="text-xs text-slate-500">
              Akumulasi curah hujan (mm) dari kalibrasi tipping-bucket 0.2mm per tip
            </p>
          </div>
        </div>

        {/* Rain Metrics */}
        <div className="flex items-center gap-3 text-xs">
          <div className="bg-sky-50/70 border border-sky-100 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] text-sky-700 block uppercase font-medium">
              Total Akumulasi
            </span>
            <span className="font-mono font-bold text-sky-950">{rainStats.total} mm</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] text-slate-500 block uppercase font-medium">
              Intensitas Maks
            </span>
            <span className="font-mono font-bold text-slate-800">{rainStats.max} mm/periode</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] text-slate-500 block uppercase font-medium">
              Counter Tipping
            </span>
            <span className="font-mono font-bold text-slate-800">
              {rainStats.latestCounter} tips
            </span>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              tickFormatter={(val) => formatChartTick(val, range)}
              tick={{ fontSize: 11, fill: "#64748b" }}
            />

            <YAxis
              unit=" mm"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#64748b" }}
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const reading = payload[0].payload as TelemetryReadingPoint;
                const mm = reading.rainfall_mm ?? 0;
                return (
                  <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-800 text-xs">
                    <p className="text-slate-400 font-mono text-[11px] mb-1.5">
                      {formatWIB(label)}
                    </p>
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <span className="flex items-center gap-1.5 text-sky-400">
                        <Droplet className="w-3 h-3" /> Curah Hujan:
                      </span>
                      <strong className="font-mono">{mm} mm</strong>
                    </div>
                    {reading.rain_counter !== undefined && (
                      <div className="flex items-center justify-between gap-4 text-slate-400 text-[11px]">
                        <span>Tipping Counter:</span>
                        <span className="font-mono">{reading.rain_counter} tips</span>
                      </div>
                    )}
                  </div>
                );
              }}
            />

            <Bar dataKey="rainfall_mm" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => {
                const mm = entry.rainfall_mm || 0;
                const fillColor = mm > 10 ? "#6366f1" : mm > 0 ? "#0ea5e9" : "#cbd5e1";
                return <Cell key={`cell-${index}`} fill={fillColor} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
