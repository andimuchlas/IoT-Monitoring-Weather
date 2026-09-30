"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  RefreshCw,
  MapPin,
  Mountain,
  Battery,
  BatteryWarning,
  Radio,
  Wifi,
  WifiOff,
  Thermometer,
  Droplets,
  Gauge,
  Wind,
  CloudRain,
  SunMedium,
  Clock,
  Compass,
  Navigation,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { getDeviceDetail, getDeviceTelemetry } from "../../../lib/api";
import { formatWIB, formatRelativeTime, checkIsOffline, formatTimeWIB } from "../../../lib/date";
import type { DeviceDetail } from "../../../types/sensor";
import type { TelemetryReadingPoint, TimeRange } from "../../../types/reading";
import { TempHumidityChart } from "../../../components/charts/temp-humidity-chart";
import { RainfallChart } from "../../../components/charts/rainfall-chart";
import { WindChart, degToCompassName } from "../../../components/charts/wind-chart";
import { SolarPressureChart } from "../../../components/charts/solar-pressure-chart";
import { SensorList } from "../../../components/sensors/sensor-list";
import { LoadingState } from "../../../components/common/loading-state";
import { ErrorState } from "../../../components/common/error-state";

export default function DeviceDetailPage() {
  const params = useParams();
  const deviceId = (params?.id as string) || "WS-GRT-001";

  const [device, setDevice] = useState<DeviceDetail | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryReadingPoint[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [loading, setLoading] = useState<boolean>(true);
  const [telemetryLoading, setTelemetryLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Load detail perangkat
  const loadDeviceData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const dev = await getDeviceDetail(deviceId);
      setDevice(dev);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err?.message || `Gagal memuat stasiun ${deviceId}`);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  // Load data telemetri berdasarkan timeRange yang dipilih
  const loadTelemetryData = useCallback(async () => {
    try {
      setTelemetryLoading(true);
      const data = await getDeviceTelemetry(deviceId, timeRange);
      setTelemetry(data);
    } catch (err: any) {
      console.warn("Error loading telemetry:", err);
    } finally {
      setTelemetryLoading(false);
    }
  }, [deviceId, timeRange]);

  useEffect(() => {
    loadDeviceData();
  }, [loadDeviceData]);

  useEffect(() => {
    loadTelemetryData();
  }, [loadTelemetryData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/60 p-6 max-w-7xl mx-auto">
        <LoadingState />
      </div>
    );
  }

  if (error || !device) {
    return (
      <div className="min-h-screen bg-slate-50/60 p-6 max-w-7xl mx-auto">
        <ErrorState message={error || "Stasiun cuaca tidak ditemukan."} onRetry={loadDeviceData} />
      </div>
    );
  }

  const isOffline = checkIsOffline(device.lastSeenAt, 15);
  const isLowBattery = device.batteryV !== null && device.batteryV < 3.7;
  const latest = device.latestReadings || {};

  return (
    <div className="p-6 md:p-8 space-y-8 font-sans">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/devices"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-colors shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Stasiun
        </Link>

        <button
          onClick={() => {
            loadDeviceData();
            loadTelemetryData();
          }}
          disabled={telemetryLoading}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${telemetryLoading ? "animate-spin text-blue-600" : ""}`}
          />
          <span className="hidden sm:inline">Refresh Data</span>
        </button>
      </div>
      {/* Offline Alert Banner */}
      {isOffline && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs"
        >
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <div className="flex-1">
            <strong className="font-bold">Peringatan: Stasiun Offline (&gt;15 Menit)</strong>
            <p className="text-rose-700 mt-0.5">
              Stasiun cuaca ini tidak mengirimkan data telemetri selama lebih dari 15 menit.
              Terakhir terdeteksi pada {formatWIB(device.lastSeenAt)}. Periksa koneksi seluler/LoRa
              atau suplai daya solar panel stasiun.
            </p>
          </div>
        </motion.div>
      )}

      {/* Station Info Hero Header */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-xs font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-200">
              {device.id}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Firmware: v{device.firmwareVersion || "1.0.0"}
            </span>

            {/* Status Badge */}
            {isOffline ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                <WifiOff className="w-3.5 h-3.5 text-rose-500" /> Offline
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Wifi className="w-3.5 h-3.5 text-emerald-600" /> Online
              </span>
            )}
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            {device.name}
          </h1>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span>{device.locationName}</span>
            </div>

            {device.altitude && (
              <div className="flex items-center gap-1.5">
                <Mountain className="w-4 h-4 text-slate-400" />
                <span className="font-mono">{device.altitude} mdpl</span>
              </div>
            )}

            {device.latitude && device.longitude && (
              <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
                <span>
                  ({device.latitude.toFixed(4)}, {device.longitude.toFixed(4)})
                </span>
              </div>
            )}

            <div
              className="flex items-center gap-1.5 text-slate-500"
              title={`Pembaruan: ${formatWIB(device.lastSeenAt)}`}
            >
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Update: {formatRelativeTime(device.lastSeenAt)}</span>
            </div>
          </div>
        </div>

        {/* Device Hardware Metrics (Battery & RSSI) */}
        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 self-start lg:self-auto">
          {/* Battery */}
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isLowBattery ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {isLowBattery ? (
                <BatteryWarning className="w-5 h-5 animate-bounce" />
              ) : (
                <Battery className="w-5 h-5" />
              )}
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block uppercase font-medium">
                Baterai
              </span>
              <span
                className={`font-mono text-sm font-bold ${
                  isLowBattery ? "text-rose-700" : "text-slate-900"
                }`}
              >
                {device.batteryV ? `${device.batteryV} V` : "-"}
              </span>
            </div>
          </div>

          <div className="h-8 w-[1px] bg-slate-200" />

          {/* RSSI Signal */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block uppercase font-medium">
                Sinyal LoRa / GSM
              </span>
              <span className="font-mono text-sm font-bold text-slate-900">
                {device.rssi ? `${device.rssi} dBm` : "-"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 6 Quick Telemetry Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Suhu */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-orange-600 mb-2">
            <span className="text-[11px] font-semibold text-slate-500">Suhu Udara</span>
            <Thermometer className="w-4 h-4" />
          </div>
          <span className="font-mono text-2xl font-bold text-slate-900">
            {latest.temp_air !== undefined ? `${latest.temp_air}°C` : "-"}
          </span>
        </div>

        {/* Kelembaban */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-sky-600 mb-2">
            <span className="text-[11px] font-semibold text-slate-500">Kelembaban</span>
            <Droplets className="w-4 h-4" />
          </div>
          <span className="font-mono text-2xl font-bold text-slate-900">
            {latest.humidity !== undefined ? `${latest.humidity}%` : "-"}
          </span>
        </div>

        {/* Tekanan */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-600 mb-2">
            <span className="text-[11px] font-semibold text-slate-500">Tekanan Baro</span>
            <Gauge className="w-4 h-4" />
          </div>
          <span className="font-mono text-2xl font-bold text-slate-900">
            {latest.pressure !== undefined ? `${latest.pressure}` : "-"}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">hPa</span>
        </div>

        {/* Angin */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-teal-600 mb-2">
            <span className="text-[11px] font-semibold text-slate-500">Kecepatan Angin</span>
            <Wind className="w-4 h-4" />
          </div>
          <span className="font-mono text-2xl font-bold text-slate-900">
            {latest.wind_speed !== undefined ? `${latest.wind_speed}` : "-"}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            m/s ({degToCompassName(latest.wind_dir)})
          </span>
        </div>

        {/* Curah Hujan */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-[11px] font-semibold text-slate-500">Rain Counter</span>
            <CloudRain className="w-4 h-4" />
          </div>
          <span className="font-mono text-2xl font-bold text-slate-900">
            {latest.rain_counter !== undefined ? `${latest.rain_counter}` : "-"}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">tips (0.2mm/tip)</span>
        </div>

        {/* Radiasi Matahari */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-500 mb-2">
            <span className="text-[11px] font-semibold text-slate-500">Radiasi Surya</span>
            <SunMedium className="w-4 h-4" />
          </div>
          <span className="font-mono text-2xl font-bold text-slate-900">
            {latest.solar_rad !== undefined ? `${latest.solar_rad}` : "-"}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">W/m²</span>
        </div>
      </div>

      {/* Time Range Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Grafik Riwayat Telemetri Multi-Sensor
          </h3>
          <p className="text-xs text-slate-500">
            Pilih interval waktu untuk agregasi otomatis (raw, 1 jam, 1 hari).
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setTimeRange("24h")}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              timeRange === "24h"
                ? "bg-white text-blue-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            24 Jam Terakhir
          </button>
          <button
            onClick={() => setTimeRange("7d")}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              timeRange === "7d"
                ? "bg-white text-blue-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            7 Hari Terakhir
          </button>
          <button
            onClick={() => setTimeRange("30d")}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              timeRange === "30d"
                ? "bg-white text-blue-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            30 Hari Terakhir
          </button>
        </div>
      </div>

      {/* Telemetry Charts Grid */}
      <div className="space-y-6">
        {/* Chart 1: Suhu & Kelembaban (Dual-Axis) */}
        <TempHumidityChart data={telemetry} range={timeRange} />

        {/* Row: Curah Hujan & Angin */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RainfallChart data={telemetry} range={timeRange} />
          <WindChart data={telemetry} range={timeRange} />
        </div>

        {/* Chart 4: Radiasi Matahari & Tekanan */}
        <SolarPressureChart data={telemetry} range={timeRange} />
      </div>

      {/* Installed Sensors & Active Calibration Table */}
      <SensorList sensors={device.installedSensors || []} />
    </div>
  );
}
