"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Thermometer,
  Droplets,
  Gauge,
  Wind,
  Battery,
  BatteryWarning,
  Radio,
  Wifi,
  WifiOff,
  ArrowRight,
  Clock,
} from "lucide-react";
import type { DeviceOverview } from "../../types/device";
import { formatRelativeTime, checkIsOffline, formatWIB } from "../../lib/date";

interface DeviceCardProps {
  device: DeviceOverview;
  index: number;
}

export function DeviceCard({ device, index }: DeviceCardProps) {
  const isOffline = checkIsOffline(device.lastSeenAt, 15);
  const isLowBattery = device.batteryV !== null && device.batteryV < 3.7;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
      className={`bg-white rounded-2xl p-6 border transition-all duration-200 flex flex-col justify-between relative overflow-hidden group hover:shadow-md ${
        isOffline
          ? "border-rose-200/80 shadow-rose-50/50"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <span className="text-[11px] font-mono font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
              {device.id}
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-1.5 group-hover:text-blue-600 transition-colors">
              {device.name}
            </h3>
            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{device.locationName}</p>
          </div>

          {/* Status Badge */}
          {isOffline ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 flex-shrink-0">
              <WifiOff className="w-3.5 h-3.5 text-rose-500" />
              Offline
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex-shrink-0">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              Online
            </span>
          )}
        </div>

        {/* Primary Sensor Metrics Grid */}
        <div className="grid grid-cols-2 gap-2.5 my-4">
          {/* Suhu */}
          <div className="bg-slate-50/80 hover:bg-orange-50/40 transition-colors p-3 rounded-xl border border-slate-100 flex items-center gap-3">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
              <Thermometer className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block font-medium">Suhu Udara</span>
              <span className="text-base font-bold font-mono text-slate-800">
                {device.latestReadings?.temp_air !== undefined
                  ? `${device.latestReadings.temp_air}°C`
                  : "-"}
              </span>
            </div>
          </div>

          {/* Kelembapan */}
          <div className="bg-slate-50/80 hover:bg-blue-50/40 transition-colors p-3 rounded-xl border border-slate-100 flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Droplets className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block font-medium">Kelembapan</span>
              <span className="text-base font-bold font-mono text-slate-800">
                {device.latestReadings?.humidity !== undefined
                  ? `${device.latestReadings.humidity}%`
                  : "-"}
              </span>
            </div>
          </div>

          {/* Tekanan Udara */}
          <div className="bg-slate-50/80 hover:bg-indigo-50/40 transition-colors p-3 rounded-xl border border-slate-100 flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block font-medium">Tekanan</span>
              <span className="text-sm font-bold font-mono text-slate-800">
                {device.latestReadings?.pressure !== undefined
                  ? `${device.latestReadings.pressure} hPa`
                  : "-"}
              </span>
            </div>
          </div>

          {/* Kecepatan Angin */}
          <div className="bg-slate-50/80 hover:bg-teal-50/40 transition-colors p-3 rounded-xl border border-slate-100 flex items-center gap-3">
            <div className="p-2 bg-teal-100 text-teal-600 rounded-lg">
              <Wind className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block font-medium">Kec. Angin</span>
              <span className="text-sm font-bold font-mono text-slate-800">
                {device.latestReadings?.wind_speed !== undefined
                  ? `${device.latestReadings.wind_speed} m/s`
                  : "-"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info & Action */}
      <div className="pt-3.5 border-t border-slate-100 space-y-2.5">
        {/* Hardware Status: Baterai, RSSI, Update Terakhir */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3 font-mono">
            {/* Battery */}
            <span
              className={`inline-flex items-center gap-1 ${
                isLowBattery ? "text-amber-600 font-semibold" : ""
              }`}
              title={isLowBattery ? "Baterai Rendah" : "Voltase Baterai"}
            >
              {isLowBattery ? (
                <BatteryWarning className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <Battery className="w-3.5 h-3.5 text-emerald-500" />
              )}
              {device.batteryV ? `${device.batteryV.toFixed(2)}V` : "-"}
            </span>

            {/* RSSI Signal */}
            <span className="inline-flex items-center gap-1" title="Kekuatan Sinyal (RSSI)">
              <Radio className="w-3.5 h-3.5 text-slate-400" />
              {device.rssi ? `${device.rssi} dBm` : "-"}
            </span>
          </div>

          {/* Last Seen (WIB) */}
          <span
            className="inline-flex items-center gap-1 text-[11px] text-slate-400"
            title={`Waktu pembaruan: ${formatWIB(device.lastSeenAt)}`}
          >
            <Clock className="w-3 h-3" />
            {formatRelativeTime(device.lastSeenAt)}
          </span>
        </div>

        {/* Link Button Detail */}
        <Link
          href={`/devices/${device.id}`}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-blue-600 bg-blue-50/70 hover:bg-blue-600 hover:text-white rounded-xl transition-all duration-150 cursor-pointer"
        >
          Lihat Grafik & Detail Sensor <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </motion.div>
  );
}
