"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Bell, ChevronDown, ChevronRight, LogOut, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TopbarProps {
  onToggleMobileMenu?: () => void;
}

export function Topbar({ onToggleMobileMenu }: TopbarProps) {
  const pathname = usePathname();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

        {/* User Profile Info with Dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
          >
            {/* Avatar with active indicator */}
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center ring-2 ring-blue-100 shadow-xs">
                AL
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
            </div>

            {/* Name only (no role or email on topbar) */}
            <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors hidden sm:inline">
              Admin Luwes
            </span>

            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-transform duration-200 hidden sm:block ${
                isDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* User Profile Dropdown Menu */}
          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 overflow-hidden"
              >
                {/* Profile Header inside Dropdown */}
                <div className="p-3 bg-slate-50/80 rounded-xl mb-1 border border-slate-100">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-900">Admin Luwes</span>
                    <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                      <Shield className="w-2.5 h-2.5" /> Super Admin
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono block">
                    admin@luwes.co.id
                  </span>
                </div>

                {/* Logout Button */}
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    // Clear session / redirect to login if implemented
                    if (typeof window !== "undefined") {
                      window.location.href = "/";
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <span>Keluar / Logout</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
