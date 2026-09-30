"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { CloudSun, Search, Radio, Wifi, WifiOff, Thermometer, Settings } from "lucide-react";
import { DeviceCard } from "../components/devices/device-card";
import { LoadingState } from "../components/common/loading-state";
import { EmptyState } from "../components/common/empty-state";
import { ErrorState } from "../components/common/error-state";
import { fetchApi, MOCK_DEVICES } from "../lib/api";
import { checkIsOffline } from "../lib/date";
import type { DeviceOverview } from "../types/device";

export default function DashboardOverviewPage() {
  const [devices, setDevices] = useState<DeviceOverview[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ONLINE" | "OFFLINE">("ALL");

  // Fetch data dari endpoint /api/v1/dashboard/overview (dengan graceful fallback ke MOCK)
  const loadDashboardData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      try {
        const data = await fetchApi<DeviceOverview[]>("/api/v1/dashboard/overview");
        setDevices(data);
      } catch (apiErr) {
        console.warn("Backend endpoint /overview not available, using mock dataset:", apiErr);
        setDevices(MOCK_DEVICES);
      }
    } catch (err: any) {
      setError(err?.message || "Gagal memuat data dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh silent setiap 30 detik
  useEffect(() => {
    loadDashboardData();
    const timer = setInterval(() => {
      loadDashboardData();
    }, 30000);
    return () => clearInterval(timer);
  }, [loadDashboardData]);

  // Statistik KPI Ringkasan
  const stats = useMemo(() => {
    const total = devices.length;
    let online = 0;
    let offline = 0;
    let tempSum = 0;
    let tempCount = 0;

    devices.forEach((d) => {
      const isOff = checkIsOffline(d.lastSeenAt, 15);
      if (isOff) offline++;
      else online++;

      if (d.latestReadings?.temp_air !== undefined) {
        tempSum += d.latestReadings.temp_air;
        tempCount++;
      }
    });

    const avgTemp = tempCount > 0 ? (tempSum / tempCount).toFixed(1) : "-";

    return { total, online, offline, avgTemp };
  }, [devices]);

  // Filter pencarian dan status online/offline
  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      const matchesSearch =
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.locationName.toLowerCase().includes(searchQuery.toLowerCase());

      const isOff = checkIsOffline(d.lastSeenAt, 15);
      if (statusFilter === "ONLINE") return matchesSearch && !isOff;
      if (statusFilter === "OFFLINE") return matchesSearch && isOff;
      return matchesSearch;
    });
  }, [devices, searchQuery, statusFilter]);

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Banner Welcome & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
            Ringkasan Telemetri Cuaca Terdistribusi
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Status operasional stasiun, agregasi metrik sensor aktif, dan deteksi stasiun offline.
          </p>
        </div>

        <Link
          href="/devices"
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5 text-slate-500" /> Kelola Stasiun &amp; Sensor
        </Link>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Card 1: Total Stasiun */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Total Stasiun</span>
            <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
              {stats.total}
            </span>
          </div>
          <div className="p-3 bg-slate-50 text-slate-600 rounded-xl border border-slate-100">
            <Radio className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Stasiun Online */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Stasiun Online</span>
            <span className="text-2xl font-bold font-mono text-emerald-600 mt-1 block">
              {stats.online}
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <Wifi className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Offline > 15m */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Offline &gt;15 Menit</span>
            <span className="text-2xl font-bold font-mono text-rose-600 mt-1 block">
              {stats.offline}
            </span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
            <WifiOff className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Rata-rata Suhu */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Rata-rata Suhu Udara</span>
            <span className="text-2xl font-bold font-mono text-orange-600 mt-1 block">
              {stats.avgTemp !== "-" ? `${stats.avgTemp}°C` : "-"}
            </span>
          </div>
          <div className="p-3 bg-orange-50 text-orange-600 rounded-xl border border-orange-100">
            <Thermometer className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
        {/* Search Box */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari stasiun atau lokasi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold w-full sm:w-auto justify-center">
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              statusFilter === "ALL"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Semua ({stats.total})
          </button>
          <button
            onClick={() => setStatusFilter("ONLINE")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              statusFilter === "ONLINE"
                ? "bg-white text-emerald-700 shadow-xs border border-slate-200/80"
                : "text-slate-600 hover:text-emerald-700"
            }`}
          >
            Online ({stats.online})
          </button>
          <button
            onClick={() => setStatusFilter("OFFLINE")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              statusFilter === "OFFLINE"
                ? "bg-white text-rose-700 shadow-xs border border-slate-200/80"
                : "text-slate-600 hover:text-rose-700"
            }`}
          >
            Offline ({stats.offline})
          </button>
        </div>
      </div>

      {/* State View Rendering: Error State */}
      {error && <ErrorState message={error} onRetry={loadDashboardData} />}

      {/* State View Rendering: Loading Skeleton */}
      {loading && devices.length === 0 ? (
        <LoadingState />
      ) : filteredDevices.length === 0 ? (
        /* State View Rendering: Empty State */
        <EmptyState
          title="Tidak Ada Stasiun yang Cocok"
          description="Tidak ada stasiun cuaca yang sesuai dengan filter pencarian Anda saat ini."
          onRefresh={() => {
            setSearchQuery("");
            setStatusFilter("ALL");
          }}
        />
      ) : (
        /* Grid of Weather Station Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredDevices.map((device, idx) => (
              <DeviceCard key={device.id} device={device} index={idx} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
