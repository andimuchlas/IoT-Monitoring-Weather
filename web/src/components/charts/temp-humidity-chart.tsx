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
import { Thermometer, Droplets, ArrowUp, ArrowDown } from "lucide-react";
import type { TelemetryReadingPoint, TimeRange } from "../../types/reading";
import { formatChartTick, formatWIB } from "../../lib/date";

interface TempHumidityChartProps {
  data: TelemetryReadingPoint[];
  range: TimeRange;
}

export function TempHumidityChart({ data, range }: TempHumidityChartProps) {
  // Hitung metrik min, max, avg
  const metrics = useMemo(() => {
    let minT = Infinity;
    let maxT = -Infinity;
    let sumT = 0;
    let countT = 0;

    let minH = Infinity;
    let maxH = -Infinity;
    let sumH = 0;
    let countH = 0;

    data.forEach((p) => {
      if (typeof p.temp_air === "number" && !isNaN(p.temp_air)) {
        if (p.temp_air < minT) minT = p.temp_air;
        if (p.temp_air > maxT) maxT = p.temp_air;
        sumT += p.temp_air;
        countT++;
      }
      if (typeof p.humidity === "number" && !isNaN(p.humidity)) {
        if (p.humidity < minH) minH = p.humidity;
        if (p.humidity > maxH) maxH = p.humidity;
        sumH += p.humidity;
        countH++;
      }
    });

    return {
      minTemp: countT > 0 ? minT.toFixed(1) : "-",
      maxTemp: countT > 0 ? maxT.toFixed(1) : "-",
      avgTemp: countT > 0 ? (sumT / countT).toFixed(1) : "-",
      minHum: countH > 0 ? minH.toFixed(1) : "-",
      maxHum: countH > 0 ? maxH.toFixed(1) : "-",
      avgHum: countH > 0 ? (sumH / countH).toFixed(1) : "-",
    };
  }, [data]);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
      {/* Header & Metrics Summary */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <Thermometer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Suhu &amp; Kelembaban Udara (Dual-Axis)
              </h3>
              <p className="text-xs text-slate-500">
                Korelasi siklus diurnal suhu (°C) dan kelembaban relatif (% RH)
              </p>
            </div>
          </div>
        </div>

        {/* Mini stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-orange-50/60 border border-orange-100/80 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] text-orange-700/80 block uppercase font-medium">
              Suhu Min / Max
            </span>
            <span className="font-mono font-bold text-orange-950">
              {metrics.minTemp}° / {metrics.maxTemp}°C
            </span>
          </div>

          <div className="bg-orange-50/60 border border-orange-100/80 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] text-orange-700/80 block uppercase font-medium">
              Suhu Rata-rata
            </span>
            <span className="font-mono font-bold text-orange-950">{metrics.avgTemp}°C</span>
          </div>

          <div className="bg-blue-50/60 border border-blue-100/80 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] text-blue-700/80 block uppercase font-medium">
              Kelembaban Min / Max
            </span>
            <span className="font-mono font-bold text-blue-950">
              {metrics.minHum}% / {metrics.maxHum}%
            </span>
          </div>

          <div className="bg-blue-50/60 border border-blue-100/80 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] text-blue-700/80 block uppercase font-medium">
              Kelembaban Avg
            </span>
            <span className="font-mono font-bold text-blue-950">{metrics.avgHum}% RH</span>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="humidityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0284c7" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
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

            {/* Sumbu Y Kiri: Suhu (°C) */}
            <YAxis
              yAxisId="left"
              domain={["auto", "auto"]}
              tickLine={false}
              axisLine={false}
              unit="°C"
              tick={{ fontSize: 11, fill: "#ea580c" }}
            />

            {/* Sumbu Y Kanan: Kelembaban (%) */}
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              unit="%"
              tick={{ fontSize: 11, fill: "#0284c7" }}
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                return (
                  <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-800 text-xs">
                    <p className="text-slate-400 font-mono text-[11px] mb-2">{formatWIB(label)}</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-orange-400">
                          <span className="w-2 h-2 rounded-full bg-orange-400"></span> Suhu:
                        </span>
                        <strong className="font-mono">{payload[0]?.value ?? "-"} °C</strong>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-sky-400">
                          <span className="w-2 h-2 rounded-full bg-sky-400"></span> Kelembaban:
                        </span>
                        <strong className="font-mono">{payload[1]?.value ?? "-"} % RH</strong>
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
              yAxisId="left"
              type="monotone"
              dataKey="temp_air"
              name="Suhu Udara (°C)"
              stroke="#ea580c"
              strokeWidth={2.5}
              fill="url(#tempGradient)"
              activeDot={{ r: 5, strokeWidth: 1, stroke: "#ffffff" }}
            />

            <Area
              yAxisId="right"
              type="monotone"
              dataKey="humidity"
              name="Kelembaban Relatif (%)"
              stroke="#0284c7"
              strokeWidth={2}
              fill="url(#humidityGradient)"
              activeDot={{ r: 5, strokeWidth: 1, stroke: "#ffffff" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
