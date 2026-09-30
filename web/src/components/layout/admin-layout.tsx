"use client";

import React, { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white flex font-sans">
      {/* Desktop Sidebar (Left) */}
      <div className="hidden lg:block fixed inset-y-0 left-0 z-30">
        <Sidebar />
      </div>

      {/* Mobile Drawer Sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            />

            {/* Sidebar Slide-in */}
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="relative flex-1 flex flex-col max-w-xs w-full bg-white z-50 shadow-2xl"
            >
              <div className="absolute top-4 right-4 z-50">
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <Sidebar onCloseMobile={() => setMobileMenuOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Column (Topbar + Content) */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Topbar (With User Profile on Right) */}
        <Topbar onToggleMobileMenu={() => setMobileMenuOpen(true)} />

        {/* Page Content Canvas */}
        <main className="flex-1 bg-white">{children}</main>
      </div>
    </div>
  );
}
