"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Bell, ChevronRight } from "lucide-react";

interface TopbarProps {
  onToggleMobileMenu?: () => void;
}

export function Topbar({ onToggleMobileMenu }: TopbarProps) {
  const pathname = usePathname();

  const getPageInfo = () => {
    if (pathname === "/") {
      return {
        title: "Dashboard Overview",
        subtitle: "Ringkasan metrik telemetri multi-sensor stasiun cuaca terdistribusi",
        breadcrumb: null,
      };
    }
    if (pathname === "/devices") {
      return {
        title: "Manajemen Stasiun & Sensor",
        subtitle: "Master data stasiun IoT, inventaris sensor, dan parameter kalibrasi waktu",
        breadcrumb: null,
      };
    }
    if (pathname.startsWith("/devices/")) {
      const id = pathname.replace("/devices/", "");
      return {
        title: `Detail Stasiun (${id})`,
        subtitle: "Monitoring grafik telemetri live dan sensor terpasang",
        breadcrumb: [
          { label: "Stasiun & Sensor", href: "/devices" },
          { label: id, href: `/devices/${id}` },
        ],
      };
    }
    if (pathname.startsWith("/logs")) {
      return {
        title: "Log Telemetri & Ingestion",
        subtitle:
          "Audit stream paket data telemetri, deteksi offline buffer, dan reset rain counter",
        breadcrumb: null,
      };
    }
    return {
      title: "IoT Weather Station",
      subtitle: "Portal Administrasi Monitoring Telemetri Cuaca",
      breadcrumb: null,
    };
  };

  const page = getPageInfo();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Left Section: Mobile Toggle & Page Title / Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
          aria-label="Toggle Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          {page.breadcrumb ? (
            <div className="flex items-center gap-1.5 text-xs">
              <Link
                href={page.breadcrumb[0].href}
                className="text-slate-500 hover:text-blue-600 font-medium transition-colors"
              >
                {page.breadcrumb[0].label}
              </Link>
              <ChevronRight className="w-3 h-3 text-slate-400" />
              <span className="font-bold font-mono text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                {page.breadcrumb[1].label}
              </span>
            </div>
          ) : (
            <h1 className="text-base font-bold text-slate-900 tracking-tight">{page.title}</h1>
          )}
          <p className="text-[11px] text-slate-400 hidden sm:block">{page.subtitle}</p>
        </div>
      </div>

      {/* Right Section: Notifications and User Profile with Dropdown */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <button
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 relative transition-colors cursor-pointer"
          title="Notifikasi Sistem"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
        </button>

        <div className="h-6 w-[1px] bg-slate-200" />

        {/* Operator Badge & System Status */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50/80 border border-slate-200/60">
          <div className="relative">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shadow-xs">
              AL
            </div>
            <span
              className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white"
              title="Sistem Aktif"
            />
          </div>

          <div className="hidden sm:block text-left">
            <span className="text-xs font-bold text-slate-800 block leading-tight">
              Admin Luwes
            </span>
            <span className="text-[10px] text-slate-400 font-medium block">Operator Stasiun</span>
          </div>
        </div>
      </div>
    </header>
  );
}
