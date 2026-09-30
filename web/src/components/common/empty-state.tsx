import React from "react";
import { Radio, RefreshCw } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  onRefresh?: () => void;
}

export function EmptyState({
  title = "Tidak ada stasiun cuaca ditemukan",
  description = "Belum ada stasiun cuaca yang terdaftar atau sesuai dengan filter pencarian Anda.",
  onRefresh,
}: EmptyStateProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center max-w-md mx-auto my-12 shadow-sm">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
        <Radio className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-semibold text-slate-800 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 mb-6">{description}</p>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" /> Reset Filter & Refresh
        </button>
      )}
    </div>
  );
}
