import React from "react";

export function LoadingState() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between h-72"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="h-5 bg-slate-200 rounded w-28"></div>
              <div className="h-6 bg-slate-200 rounded-full w-20"></div>
            </div>
            <div className="h-6 bg-slate-200 rounded w-48 mb-2"></div>
            <div className="h-4 bg-slate-100 rounded w-36 mb-6"></div>

            <div className="grid grid-cols-2 gap-3">
              <div className="h-16 bg-slate-100 rounded-xl"></div>
              <div className="h-16 bg-slate-100 rounded-xl"></div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="h-4 bg-slate-100 rounded w-24"></div>
            <div className="h-4 bg-slate-100 rounded w-16"></div>
          </div>
        </div>
      ))}
    </div>
  );
}
