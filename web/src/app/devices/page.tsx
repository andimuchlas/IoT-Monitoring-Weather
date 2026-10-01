"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Search,
  Radio,
  Wifi,
  WifiOff,
  Battery,
  BatteryWarning,
  Cpu,
  ArrowRight,
  Sliders,
  Settings,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Clock,
  Layers,
  MapPin,
  X,
  RefreshCw,
} from "lucide-react";
import { fetchApi, getDeviceDetail } from "../../lib/api";
import { formatWIB, formatRelativeTime, checkIsOffline } from "../../lib/date";
import type { DeviceOverview, DeviceStatus } from "../../types/device";
import type { DeviceDetail, SensorItem } from "../../types/sensor";

export default function DevicesManagementPage() {
  const [devicesList, setDevicesList] = useState<DeviceDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"STATIONS" | "SENSORS">("STATIONS");

  // Load data stasiun live dari API
  const loadDevices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchApi<any>("/api/v1/dashboard/overview");
      const list = Array.isArray(res) ? res : (res?.stations ?? []);
      if (Array.isArray(list) && list.length > 0) {
        const details = await Promise.all(
          list.map(async (st: any) => {
            try {
              return await getDeviceDetail(st.id);
            } catch {
              return {
                id: st.id,
                name: st.name,
                locationName: st.locationName || st.location || "Lokasi Sensor",
                status: st.status || "active",
                firmwareVersion: st.firmwareVersion || "1.4.2",
                batteryV: st.batteryV ?? 3.9,
                rssi: st.rssi ?? -70,
                lastSeenAt: st.lastSeenAt || new Date().toISOString(),
                isOffline: st.isOffline ?? false,
                latitude: -6.9,
                longitude: 107.6,
                altitude: 500,
                latestReadings: st.latestReadings || {},
                installedSensors: [],
              };
            }
          })
        );
        setDevicesList(details);
      } else {
        setDevicesList([]);
      }
    } catch (err) {
      console.warn("Failed to load devices from backend:", err);
      setDevicesList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  // State untuk modal tambah stasiun
  const [showAddStationModal, setShowAddStationModal] = useState(false);
  const [newStation, setNewStation] = useState({
    id: "",
    name: "",
    locationName: "",
    altitude: 500,
    latitude: -6.9,
    longitude: 107.6,
  });

  // State untuk modal pindah sensor / kalibrasi
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferData, setTransferData] = useState({
    sensorSerial: "",
    sourceDeviceId: "",
    targetDeviceId: "",
    scale: 1.0,
    offset: 0.0,
    notes: "",
  });

  // Notifikasi toast sederhana
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Semua sensor dari seluruh stasiun
  const allSensors = useMemo(() => {
    const list: { sensor: SensorItem; deviceId: string; deviceName: string }[] = [];
    devicesList.forEach((dev) => {
      dev.installedSensors.forEach((s) => {
        list.push({ sensor: s, deviceId: dev.id, deviceName: dev.name });
      });
    });
    return list;
  }, [devicesList]);

  // Statistik Ringkasan
  const stats = useMemo(() => {
    const totalDevices = devicesList.length;
    let onlineCount = 0;
    let offlineCount = 0;
    let maintenanceCount = 0;

    devicesList.forEach((d) => {
      const isOff = checkIsOffline(d.lastSeenAt, 15);
      if (d.status === "maintenance") maintenanceCount++;
      else if (isOff) offlineCount++;
      else onlineCount++;
    });

    return {
      totalDevices,
      onlineCount,
      offlineCount,
      maintenanceCount,
      totalSensors: allSensors.length,
    };
  }, [devicesList, allSensors]);

  // Filtered devices
  const filteredDevices = useMemo(() => {
    return devicesList.filter((d) => {
      const matchesSearch =
        d.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.locationName.toLowerCase().includes(searchQuery.toLowerCase());

      const isOff = checkIsOffline(d.lastSeenAt, 15);

      if (statusFilter === "ACTIVE") return matchesSearch && !isOff && d.status === "active";
      if (statusFilter === "OFFLINE") return matchesSearch && isOff;
      if (statusFilter === "MAINTENANCE") return matchesSearch && d.status === "maintenance";
      return matchesSearch;
    });
  }, [devicesList, searchQuery, statusFilter]);

  // Handle Create Station
  const handleCreateStation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStation.id || !newStation.name) {
      alert("Harap isi ID dan Nama stasiun.");
      return;
    }

    const created: DeviceDetail = {
      id: newStation.id.toUpperCase(),
      name: newStation.name,
      locationName: newStation.locationName || "Lokasi Baru",
      status: "active",
      firmwareVersion: "1.0.0",
      batteryV: 4.1,
      rssi: -65,
      lastSeenAt: new Date().toISOString(),
      isOffline: false,
      altitude: Number(newStation.altitude) || 500,
      latitude: Number(newStation.latitude) || -6.9,
      longitude: Number(newStation.longitude) || 107.6,
      latestReadings: {
        temp_air: 25.0,
        humidity: 80.0,
        pressure: 1010.0,
        wind_speed: 1.5,
        wind_dir: 180,
        rain_counter: 0,
        solar_rad: 400,
      },
      installedSensors: [],
    };

    setDevicesList((prev) => [created, ...prev]);
    setShowAddStationModal(false);
    setNewStation({
      id: "",
      name: "",
      locationName: "",
      altitude: 500,
      latitude: -6.9,
      longitude: 107.6,
    });
    showToast(`Stasiun ${created.id} berhasil ditambahkan!`);
  };

  // Handle Transfer & Kalibrasi Sensor
  const handleTransferSensor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferData.sensorSerial || !transferData.targetDeviceId) {
      alert("Pilih sensor dan stasiun tujuan.");
      return;
    }

    let transferredSensor: SensorItem | null = null;

    // Remove from source
    const updatedDevices = devicesList.map((dev) => {
      const remainingSensors = dev.installedSensors.filter((s) => {
        if (s.serialNumber === transferData.sensorSerial) {
          transferredSensor = {
            ...s,
            calibration: {
              id: `cal-${Date.now()}`,
              sensorId: s.id,
              scale: Number(transferData.scale),
              offset: Number(transferData.offset),
              effectiveFrom: new Date().toISOString(),
              notes: transferData.notes || "Pemindahan sensor stasiun",
            },
          };
          return false;
        }
        return true;
      });

      return {
        ...dev,
        installedSensors: remainingSensors,
      };
    });

    // Add to target
    if (transferredSensor) {
      const finalDevices = updatedDevices.map((dev) => {
        if (dev.id === transferData.targetDeviceId) {
          return {
            ...dev,
            installedSensors: [...dev.installedSensors, transferredSensor!],
          };
        }
        return dev;
      });

      setDevicesList(finalDevices);
      setShowTransferModal(false);
      showToast(
        `Sensor ${transferData.sensorSerial} berhasil dipindahkan ke ${transferData.targetDeviceId} dengan kalibrasi baru!`
      );
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 font-sans">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs border border-slate-700 font-medium"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Banner Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
            Manajemen Stasiun Cuaca &amp; Sensor
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Inventaris stasiun IoT, audit trail perpindahan sensor, dan setelan parameter kalibrasi
            waktu.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => setShowTransferModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
            <span>Pindah / Kalibrasi</span>
          </button>

          <button
            onClick={() => setShowAddStationModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs shadow-blue-500/20 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Stasiun</span>
          </button>
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Total Stasiun</span>
            <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
              {stats.totalDevices}
            </span>
          </div>
          <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
            <Radio className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Stasiun Online</span>
            <span className="text-2xl font-bold font-mono text-emerald-600 mt-1 block">
              {stats.onlineCount}
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Wifi className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Stasiun Offline</span>
            <span className="text-2xl font-bold font-mono text-rose-600 mt-1 block">
              {stats.offlineCount}
            </span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <WifiOff className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Sensor Terpasang</span>
            <span className="text-2xl font-bold font-mono text-blue-600 mt-1 block">
              {stats.totalSensors} unit
            </span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Cpu className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Sub-Tabs: Stasiun vs Sensor & Audit */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab("STATIONS")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "STATIONS"
              ? "bg-blue-600 text-white shadow-xs shadow-blue-500/20"
              : "bg-slate-100 text-slate-600 hover:text-slate-900"
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Daftar Stasiun Cuaca ({stats.totalDevices})</span>
        </button>

        <button
          onClick={() => setActiveTab("SENSORS")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "SENSORS"
              ? "bg-blue-600 text-white shadow-xs shadow-blue-500/20"
              : "bg-slate-100 text-slate-600 hover:text-slate-900"
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Inventaris &amp; Audit Kalibrasi Sensor ({stats.totalSensors})</span>
        </button>
      </div>

      {activeTab === "STATIONS" ? (
        <>
          {/* Search & Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari ID, stasiun, atau lokasi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold w-full sm:w-auto justify-center">
              <button
                onClick={() => setStatusFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === "ALL"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Semua ({stats.totalDevices})
              </button>
              <button
                onClick={() => setStatusFilter("ACTIVE")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === "ACTIVE"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-600 hover:text-emerald-700"
                }`}
              >
                Online ({stats.onlineCount})
              </button>
              <button
                onClick={() => setStatusFilter("OFFLINE")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === "OFFLINE"
                    ? "bg-white text-rose-700 shadow-xs"
                    : "text-slate-600 hover:text-rose-700"
                }`}
              >
                Offline ({stats.offlineCount})
              </button>
            </div>
          </div>

          {/* Stations Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-5">Stasiun &amp; ID</th>
                    <th className="py-3.5 px-5">Lokasi &amp; Elevasi</th>
                    <th className="py-3.5 px-5">Sensor Terpasang</th>
                    <th className="py-3.5 px-5">Baterai &amp; Sinyal</th>
                    <th className="py-3.5 px-5">Status &amp; Terakhir Aktif</th>
                    <th className="py-3.5 px-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredDevices.map((dev) => {
                    const isOff = checkIsOffline(dev.lastSeenAt, 15);
                    const isLowBattery = dev.batteryV !== null && dev.batteryV < 3.7;

                    return (
                      <tr key={dev.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* ID & Name */}
                        <td className="py-4 px-5">
                          <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60 inline-block mb-1">
                            {dev.id}
                          </span>
                          <Link
                            href={`/devices/${dev.id}`}
                            className="font-bold text-slate-900 block hover:text-blue-600 transition-colors text-sm"
                          >
                            {dev.name}
                          </Link>
                          <span className="text-[11px] text-slate-400 font-mono">
                            FW: v{dev.firmwareVersion || "1.0.0"}
                          </span>
                        </td>

                        {/* Location */}
                        <td className="py-4 px-5 text-slate-600">
                          <div className="flex items-center gap-1 text-slate-800 font-semibold">
                            <MapPin className="w-3.5 h-3.5 text-blue-500" />
                            <span>{dev.locationName}</span>
                          </div>
                          {dev.altitude && (
                            <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                              {dev.altitude} mdpl
                            </span>
                          )}
                        </td>

                        {/* Installed Sensors */}
                        <td className="py-4 px-5">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {dev.installedSensors.map((s) => (
                              <span
                                key={s.id}
                                className="inline-flex items-center gap-1 text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200"
                                title={`${s.name} (${s.serialNumber})`}
                              >
                                <Cpu className="w-2.5 h-2.5 text-slate-400" />
                                {s.sensorTypeId}
                              </span>
                            ))}
                            {dev.installedSensors.length === 0 && (
                              <span className="text-slate-400 text-[11px]">0 sensor terpasang</span>
                            )}
                          </div>
                        </td>

                        {/* Battery & RSSI */}
                        <td className="py-4 px-5">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              {isLowBattery ? (
                                <BatteryWarning className="w-3.5 h-3.5 text-rose-500" />
                              ) : (
                                <Battery className="w-3.5 h-3.5 text-emerald-600" />
                              )}
                              <span
                                className={`font-mono text-[11px] font-semibold ${
                                  isLowBattery ? "text-rose-600" : "text-slate-800"
                                }`}
                              >
                                {dev.batteryV ? `${dev.batteryV} V` : "-"}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Radio className="w-3 h-3 text-slate-400" />
                              <span className="font-mono text-[11px]">
                                {dev.rssi ? `${dev.rssi} dBm` : "-"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-5">
                          <div className="space-y-1">
                            {isOff ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                <WifiOff className="w-2.5 h-2.5" /> Offline
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Wifi className="w-2.5 h-2.5" /> Online
                              </span>
                            )}
                            <span
                              className="text-[11px] text-slate-400 block"
                              title={`Waktu: ${formatWIB(dev.lastSeenAt)}`}
                            >
                              {formatRelativeTime(dev.lastSeenAt)}
                            </span>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="py-4 px-5 text-right">
                          <Link
                            href={`/devices/${dev.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white transition-all cursor-pointer"
                          >
                            Detail &amp; Grafik <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Tab SENSORS: Inventaris & Audit Kalibrasi Sensor */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Inventaris Seluruh Sensor ({allSensors.length}) &amp; Formula Kalibrasi Waktu
              </h3>
              <p className="text-xs text-slate-500">
                Audit trail sensor Narrow Format, stasiun pemasangan aktif, dan formula kalibrasi
                linear f(x) = scale*x + offset
              </p>
            </div>

            <button
              onClick={() => setShowTransferModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Pindah / Kalibrasi Sensor</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-5">Sensor &amp; Tipe</th>
                  <th className="py-3.5 px-5">Serial Number</th>
                  <th className="py-3.5 px-5">Stasiun Terpasang</th>
                  <th className="py-3.5 px-5">Formula Kalibrasi Aktif</th>
                  <th className="py-3.5 px-5">Rentang Operasional</th>
                  <th className="py-3.5 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {allSensors.map(({ sensor, deviceId, deviceName }) => {
                  const cal = sensor.calibration;
                  return (
                    <tr key={sensor.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-5">
                        <span className="font-bold text-slate-900 block">{sensor.name}</span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          type: {sensor.sensorTypeId}
                        </span>
                      </td>

                      <td className="py-4 px-5 font-mono text-slate-700">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200/60">
                          {sensor.serialNumber}
                        </span>
                      </td>

                      <td className="py-4 px-5">
                        <Link
                          href={`/devices/${deviceId}`}
                          className="font-bold text-blue-600 hover:underline block"
                        >
                          {deviceId}
                        </Link>
                        <span className="text-[11px] text-slate-400 block">{deviceName}</span>
                      </td>

                      <td className="py-4 px-5">
                        {cal ? (
                          <div className="space-y-0.5">
                            <code className="text-[11px] font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 inline-block">
                              f(x) = {cal.scale}x{" "}
                              {cal.offset >= 0 ? `+ ${cal.offset}` : `- ${Math.abs(cal.offset)}`}
                            </code>
                            {cal.notes && (
                              <span className="text-[10px] text-slate-400 block italic line-clamp-1">
                                {cal.notes}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">
                            Default (1.0x + 0.0)
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-5 text-slate-600">
                        {sensor.sensorType ? (
                          <span>
                            {sensor.sensorType.minVal} s/d {sensor.sensorType.maxVal}{" "}
                            <strong className="font-mono text-slate-800">
                              {sensor.sensorType.unit}
                            </strong>
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="py-4 px-5 text-right">
                        <button
                          onClick={() => {
                            setTransferData({
                              sensorSerial: sensor.serialNumber,
                              sourceDeviceId: deviceId,
                              targetDeviceId: "",
                              scale: cal?.scale || 1.0,
                              offset: cal?.offset || 0.0,
                              notes: "",
                            });
                            setShowTransferModal(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
                          <span>Pindah</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Tambah Stasiun Cuaca Baru */}
      <AnimatePresence>
        {showAddStationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Tambah Stasiun Cuaca Baru
                    </h3>
                    <p className="text-xs text-slate-500">Daftarkan stasiun cuaca IoT baru</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddStationModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateStation} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    ID Stasiun (Device ID)
                  </label>
                  <input
                    type="text"
                    placeholder="misal: WS-BDO-004"
                    value={newStation.id}
                    onChange={(e) => setNewStation({ ...newStation, id: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Stasiun</label>
                  <input
                    type="text"
                    placeholder="misal: Stasiun Cuaca Bandung Utara"
                    value={newStation.name}
                    onChange={(e) => setNewStation({ ...newStation, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Lokasi &amp; Wilayah
                  </label>
                  <input
                    type="text"
                    placeholder="misal: Dago Pakar, Jawa Barat"
                    value={newStation.locationName}
                    onChange={(e) => setNewStation({ ...newStation, locationName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Elevasi (mdpl)
                    </label>
                    <input
                      type="number"
                      value={newStation.altitude}
                      onChange={(e) =>
                        setNewStation({ ...newStation, altitude: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={newStation.latitude}
                      onChange={(e) =>
                        setNewStation({ ...newStation, latitude: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={newStation.longitude}
                      onChange={(e) =>
                        setNewStation({ ...newStation, longitude: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddStationModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs cursor-pointer"
                  >
                    Simpan Stasiun
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Pindah / Pasang Sensor & Kalibrasi */}
      <AnimatePresence>
        {showTransferModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                    <ArrowRightLeft className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Pindah Sensor &amp; Kalibrasi Waktu
                    </h3>
                    <p className="text-xs text-slate-500">
                      Audit trail perpindahan fisik sensor dan update formula kalibrasi
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleTransferSensor} className="p-6 space-y-4 text-xs">
                {/* Select Sensor */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Pilih Sensor yang Dipindahkan
                  </label>
                  <select
                    value={transferData.sensorSerial}
                    onChange={(e) => {
                      const serial = e.target.value;
                      const match = allSensors.find((s) => s.sensor.serialNumber === serial);
                      setTransferData({
                        ...transferData,
                        sensorSerial: serial,
                        sourceDeviceId: match?.deviceId || "",
                        scale: match?.sensor.calibration?.scale || 1.0,
                        offset: match?.sensor.calibration?.offset || 0.0,
                      });
                    }}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">-- Pilih Sensor --</option>
                    {allSensors.map((s) => (
                      <option key={s.sensor.id} value={s.sensor.serialNumber}>
                        {s.sensor.name} ({s.sensor.serialNumber}) - di {s.deviceId}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stasiun Tujuan */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Stasiun Cuaca Tujuan
                  </label>
                  <select
                    value={transferData.targetDeviceId}
                    onChange={(e) =>
                      setTransferData({ ...transferData, targetDeviceId: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">-- Pilih Stasiun Tujuan --</option>
                    {devicesList.map((dev) => (
                      <option key={dev.id} value={dev.id}>
                        {dev.name} ({dev.id})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Parameter Kalibrasi Baru */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Formula Kalibrasi Baru</span>
                    <code className="text-[11px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      f(x) = {transferData.scale}x{" "}
                      {transferData.offset >= 0
                        ? `+ ${transferData.offset}`
                        : `- ${Math.abs(transferData.offset)}`}
                    </code>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">
                        Scale Factor (m)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={transferData.scale}
                        onChange={(e) =>
                          setTransferData({ ...transferData, scale: Number(e.target.value) })
                        }
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">Offset (c)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={transferData.offset}
                        onChange={(e) =>
                          setTransferData({ ...transferData, offset: Number(e.target.value) })
                        }
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      Catatan Kalibrasi / Chamber
                    </label>
                    <input
                      type="text"
                      placeholder="misal: Kalibrasi ulang setelah perpindahan stasiun"
                      value={transferData.notes}
                      onChange={(e) => setTransferData({ ...transferData, notes: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowTransferModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-xs cursor-pointer"
                  >
                    Terapkan Perpindahan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
