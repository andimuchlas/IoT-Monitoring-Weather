"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Radio, Activity, CloudSun } from "lucide-react";

interface SidebarProps {
  onCloseMobile?: () => void;
}

export function Sidebar({ onCloseMobile }: SidebarProps) {
  const pathname = usePathname();

  const menuItems = [
    {
      label: "Dashboard Overview",
      href: "/",
      icon: LayoutDashboard,
      isActive: pathname === "/",
    },
    {
      label: "Stasiun & Sensor",
      href: "/devices",
      icon: Radio,
      isActive: pathname.startsWith("/devices"),
    },
    {
      label: "Log Telemetri",
      href: "/logs",
      icon: Activity,
      isActive: pathname.startsWith("/logs"),
    },
  ];

  return (
    <aside className="w-64 h-screen bg-white border-r border-slate-200 flex flex-col justify-between select-none">
      {/* Brand Header */}
      <div>
        <div className="h-16 px-6 border-b border-slate-200 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/25 flex-shrink-0">
            <CloudSun className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <h2 className="text-sm font-bold text-slate-900 truncate">IoT Weather Station</h2>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="p-4 space-y-1.5">
          <span className="px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase block mb-2 font-mono">
            MENU NAVIGASI
          </span>

          <nav className="space-y-1">
            {menuItems.map((item) => {
              const IconComponent = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onCloseMobile}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    item.isActive
                      ? "bg-blue-50 text-blue-700 shadow-xs border border-blue-100/80 font-bold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <IconComponent
                      className={`w-4 h-4 ${item.isActive ? "text-blue-600" : "text-slate-400"}`}
                    />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}
