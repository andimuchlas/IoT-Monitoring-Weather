"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Search,
  RefreshCw,
  Radio,
  CheckCircle2,
  RotateCcw,
  Zap,
  Code,
  X,
  Inbox,
  AlertCircle,
} from "lucide-react";
import { formatWIB } from "../../lib/date";
import { getTelemetryLogs, type TelemetryLogEntry } from "../../lib/api";

export default function TelemetryLogsPage() {
  const [logs, setLogs] = useState<TelemetryLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deviceFilter, setDeviceFilter] = useState<string>("ALL");
  const [modeFilter, setModeFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedPayload, setSelectedPayload] = useState<TelemetryLogEntry | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTelemetryLogs();
      setLogs(data);
    } catch (err: any) {
      setError(err?.message || "Gagal memuat log telemetri");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Ekstrak daftar stasiun unik untuk dropdown
  const stationOptions = useMemo(() => {
    const map = new Map<string, string>();
    map.set("WS-GRT-001", "WS-GRT-001 (Lembang 01)");
    map.set("WS-CSR-002", "WS-CSR-002 (Cisarua 02)");
    map.set("WS-DPK-003", "WS-DPK-003 (Depok 03)");

    for (const log of logs) {
      if (log.deviceId && !map.has(log.deviceId)) {
        map.set(log.deviceId, `${log.deviceId} (${log.stationName})`);
      }
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [logs]);

  // Statistik Realtime dari data aktual
  const stats = useMemo(() => {
    const total = logs.length;
    const offlineBatch = logs.filter((l) => l.ingestMode === "offline_batch").length;
    const dedup = logs.filter((l) => l.status === "DEDUPLICATED").length;
    const rainReset = logs.filter((l) => l.status === "RAIN_RESET").length;
    return { total, offlineBatch, dedup, rainReset };
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
      const matchDevice = deviceFilter === "ALL" || item.deviceId === deviceFilter;
      const matchMode =
        modeFilter === "ALL" ||
        (modeFilter === "BATCH" && item.ingestMode === "offline_batch") ||
        (modeFilter === "RESET" && item.status === "RAIN_RESET") ||
        (modeFilter === "DEDUP" && item.status === "DEDUPLICATED");

      const matchSearch =
        item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.deviceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.stationName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchDevice && matchMode && matchSearch;
    });
  }, [logs, deviceFilter, modeFilter, searchQuery]);

  return (
    <div className="p-6 md:p-8 space-y-8 font-sans">
      {/* Page Title Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
            Audit &amp; Log Ingestion Telemetri
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Inspeksi stream paket HTTP telemetri live, deteksi pengiriman burst offline buffer,
            idempotency deduplication, dan audit kalkulasi reset rain counter.
          </p>
        </div>

        <button
          onClick={loadLogs}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
          <span>Segarkan Log</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <p className="flex-1">{error}</p>
        </div>
      )}

      {/* 4 Summary Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Total Paket Stream</span>
            <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
              {stats.total.toLocaleString()}
            </span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Offline Buffer Ingest</span>
            <span className="text-2xl font-bold font-mono text-amber-600 mt-1 block">
              {stats.offlineBatch} pkt
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Deduplikasi Idempoten</span>
            <span className="text-2xl font-bold font-mono text-indigo-600 mt-1 block">
              {stats.dedup} pkt
            </span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Event Rain Reset</span>
            <span className="text-2xl font-bold font-mono text-emerald-600 mt-1 block">
              {stats.rainReset} kali
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <RotateCcw className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari ID paket atau stasiun..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        {/* Filter Dropdown & Tabs */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Station Filter */}
          <select
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="ALL">Semua Stasiun</option>
            {stationOptions.map((st) => (
              <option key={st.id} value={st.id}>
                {st.label}
              </option>
            ))}
          </select>

          {/* Mode Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setModeFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                modeFilter === "ALL"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setModeFilter("BATCH")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                modeFilter === "BATCH"
                  ? "bg-white text-amber-700 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-amber-700"
              }`}
            >
              Offline Batch
            </button>
            <button
              onClick={() => setModeFilter("RESET")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                modeFilter === "RESET"
                  ? "bg-white text-emerald-700 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-emerald-700"
              }`}
            >
              Rain Reset
            </button>
            <button
              onClick={() => setModeFilter("DEDUP")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                modeFilter === "DEDUP"
                  ? "bg-white text-indigo-700 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-indigo-700"
              }`}
            >
              Deduplikasi
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-5">Paket &amp; Stasiun</th>
                <th className="py-3.5 px-5">Waktu Sensor vs Server (WIB)</th>
                <th className="py-3.5 px-5">Mode Ingestion</th>
                <th className="py-3.5 px-5">Snapshot Sensor (T/RH/P/Wind/Rain)</th>
                <th className="py-3.5 px-5">Status Validasi</th>
                <th className="py-3.5 px-5 text-right">Raw Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Memuat log telemetri live...</span>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Inbox className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">Belum ada paket telemetri</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Data stream telemetri akan muncul di sini saat simulator atau perangkat IoT
                      aktif.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* ID & Station */}
                      <td className="py-4 px-5">
                        <span className="font-mono text-xs font-bold text-slate-900 block">
                          {log.id}
                        </span>
                        <span className="font-mono text-[11px] text-blue-600 font-semibold">
                          {log.deviceId}
                        </span>
                        <span className="text-[11px] text-slate-400 block font-sans">
                          {log.stationName}
                        </span>
                      </td>

                      {/* Sensor Time vs Server Time */}
                      <td className="py-4 px-5">
                        <div className="space-y-0.5 font-mono text-[11px]">
                          <div className="text-slate-700">
                            <span className="text-slate-400 text-[10px] uppercase font-sans mr-1">
                              Sensor:
                            </span>
                            {formatWIB(log.sensorTime)}
                          </div>
                          <div className="text-slate-500">
                            <span className="text-slate-400 text-[10px] uppercase font-sans mr-1">
                              Server:
                            </span>
                            {formatWIB(log.serverTime)}
                          </div>
                        </div>
                      </td>

                      {/* Mode Ingest */}
                      <td className="py-4 px-5">
                        {log.ingestMode === "offline_batch" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Zap className="w-3 h-3 text-amber-500" /> Offline Batch
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                            <Radio className="w-3 h-3 text-slate-400" /> Realtime
                          </span>
                        )}
                      </td>

                      {/* Sensor Snapshot */}
                      <td className="py-4 px-5 font-mono text-[11px]">
                        <div className="flex flex-wrap gap-2 text-slate-700">
                          <span title="Suhu">
                            {log.temp_air !== null ? `${log.temp_air}°C` : "-"}
                          </span>
                          <span className="text-slate-300">/</span>
                          <span title="Kelembaban">
                            {log.humidity !== null ? `${log.humidity}%` : "-"}
                          </span>
                          <span className="text-slate-300">/</span>
                          <span title="Tekanan">
                            {log.pressure !== null ? `${log.pressure} hPa` : "-"}
                          </span>
                          <span className="text-slate-300">/</span>
                          <span title="Angin">
                            {log.wind_speed !== null ? `${log.wind_speed} m/s` : "-"}
                          </span>
                          <span className="text-slate-300">/</span>
                          <span
                            className={`font-bold ${
                              log.status === "RAIN_RESET"
                                ? "text-emerald-700 bg-emerald-50 px-1 rounded"
                                : "text-blue-700"
                            }`}
                            title="Rain Counter"
                          >
                            {log.rain_counter !== null ? `${log.rain_counter} tips` : "-"}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5">
                        {log.status === "RAIN_RESET" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <RotateCcw className="w-3 h-3" /> Reset Handled
                          </span>
                        ) : log.status === "DEDUPLICATED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <CheckCircle2 className="w-3 h-3" /> Deduplicated
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Valid
                          </span>
                        )}
                      </td>

                      {/* JSON Trigger */}
                      <td className="py-4 px-5 text-right">
                        <button
                          onClick={() => setSelectedPayload(log)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                          title="Lihat Raw JSON"
                        >
                          <Code className="w-3.5 h-3.5 text-slate-500" />
                          <span>JSON</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal View Raw Payload */}
      <AnimatePresence>
        {selectedPayload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Code className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Raw Ingestion Payload ({selectedPayload.id})
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Stasiun: {selectedPayload.deviceId} ({selectedPayload.stationName})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPayload(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto font-mono text-xs bg-slate-950 text-emerald-400 rounded-b-2xl">
                <pre>{JSON.stringify(selectedPayload.rawPayload, null, 2)}</pre>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
