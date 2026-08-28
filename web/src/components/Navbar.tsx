"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Search, Settings, LogOut, Activity } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/traders", label: "Cesta de Traders", icon: Users },
    { href: "/analytics", label: "Analizador de Carteras", icon: Search },
    { href: "/settings", label: "Ajustes & Telegram", icon: Settings },
  ];

  if (pathname === "/" || pathname === "/auth") {
    return null;
  }

  return (
    <nav className="border-b border-surface-border bg-surface/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary animate-pulse" />
            </div>
            <Link href="/dashboard" className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              HyperCopy <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">PAPER</span>
            </Link>
          </div>

          <div className="flex space-x-1 sm:space-x-4">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-primary/20 text-emerald-400 border border-primary/30"
                      : "text-gray-400 hover:text-gray-100 hover:bg-gray-800/60"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{link.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/auth"
              className="text-gray-400 hover:text-red-400 p-2 rounded-lg hover:bg-gray-800/60 transition-colors flex items-center gap-1 text-sm"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
