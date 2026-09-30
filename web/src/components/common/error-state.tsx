import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = "Terjadi kesalahan saat memuat data stasiun cuaca.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 my-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-rose-100 rounded-xl text-rose-600 flex-shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-semibold text-sm">Gagal Mengambil Data</h4>
          <p className="text-xs text-rose-600 mt-0.5">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
        </button>
      )}
    </div>
  );
}
