"use client";

import React from "react";
import {
  Cpu,
  Activity,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Clock,
  Sparkles,
} from "lucide-react";
import type { SensorItem } from "../../types/sensor";
import { formatWIB } from "../../lib/date";

interface SensorListProps {
  sensors: SensorItem[];
}

export function SensorList({ sensors }: SensorListProps) {
  if (!sensors || sensors.length === 0) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
        <Cpu className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-600 font-medium">
          Belum ada sensor yang terpasang pada stasiun ini.
        </p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Aktif
          </span>
        );
      case "maintenance":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Wrench className="w-3 h-3" /> Pemeliharaan
          </span>
        );
      case "faulty":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3" /> Rusak
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Sensor Terpasang ({sensors.length}) &amp; Formula Kalibrasi
            </h3>
            <p className="text-xs text-slate-500">
              Audit trail instalasi sensor (Narrow Format) dengan time-based calibration (scale
              &amp; offset)
            </p>
          </div>
        </div>
      </div>

      {/* Table view */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-3 px-5">Sensor &amp; Tipe</th>
              <th className="py-3 px-5">Serial Number</th>
              <th className="py-3 px-5">Rentang Operasional</th>
              <th className="py-3 px-5">Formula Kalibrasi Aktif</th>
              <th className="py-3 px-5">Waktu Pasang</th>
              <th className="py-3 px-5 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {sensors.map((sensor) => {
              const cal = sensor.calibration;
              const hasCal = cal && (cal.scale !== 1.0 || cal.offset !== 0.0);

              return (
                <tr key={sensor.id} className="hover:bg-slate-50/50 transition-colors">
                  {/* Name & Type */}
                  <td className="py-3.5 px-5">
                    <span className="font-bold text-slate-900 block">{sensor.name}</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      type: {sensor.sensorTypeId}
                    </span>
                  </td>

                  {/* Serial Number */}
                  <td className="py-3.5 px-5 font-mono text-slate-700">
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200/60">
                      {sensor.serialNumber}
                    </span>
                  </td>

                  {/* Unit & Range */}
                  <td className="py-3.5 px-5 text-slate-600">
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

                  {/* Calibration Formula */}
                  <td className="py-3.5 px-5">
                    {cal ? (
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <code className="text-[11px] font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            f(x) = {cal.scale}x{" "}
                            {cal.offset >= 0 ? `+ ${cal.offset}` : `- ${Math.abs(cal.offset)}`}
                          </code>
                          {hasCal && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1 rounded font-sans">
                              Disetel
                            </span>
                          )}
                        </div>
                        {cal.notes && (
                          <span className="text-[10px] text-slate-400 italic line-clamp-1">
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

                  {/* Installed At */}
                  <td className="py-3.5 px-5 text-slate-500 font-mono text-[11px]">
                    {formatWIB(sensor.installedAt)}
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-5 text-right">{getStatusBadge(sensor.status)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
