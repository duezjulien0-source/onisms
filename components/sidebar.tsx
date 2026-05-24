"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Phone,
  Users,
  Wallet,
  History,
} from "lucide-react";
import type { Profile, AgencyWallet } from "@/lib/profile";
import { LogoutButton } from "./logout-button";
import { ThemeSwitcher } from "./theme-switcher";

interface SidebarProps {
  profile: Profile;
  wallet: AgencyWallet | null;
}

export function Sidebar({ profile, wallet }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { href: "/protected", label: "Dashboard", icon: LayoutDashboard, show: true },
    { href: "/protected/numbers", label: "Mes numéros", icon: Phone, show: true },
    { href: "/protected/vas", label: "Mes VAs", icon: Users, show: profile.role === "admin" },
    { href: "/protected/costs", label: "Coûts par VA", icon: Wallet, show: true },
    { href: "/protected/history", label: "Historique", icon: History, show: true },
  ];

  const displayName = profile.display_name || profile.email.split("@")[0];
  const initial = displayName.substring(0, 1).toUpperCase();

  const usagePct =
    wallet && wallet.total_recharged > 0
      ? Math.min(100, ((wallet.total_recharged - wallet.balance) / wallet.total_recharged) * 100)
      : 0;

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col h-screen sticky top-0">
      {/* Branding */}
      <div className="p-4 border-b border-border">
        <Link href="/protected" className="text-xl font-bold flex items-center gap-1">
          <span className="text-foreground">Oni</span>
          <span className="text-primary">SMS</span>
        </Link>
      </div>

      {/* User info */}
      <div className="p-4 border-b border-border flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
          {initial}
        </div>
        <div className="flex flex-col">
          <span className="font-medium text-sm">{displayName}</span>
          <span
            className={`text-xs font-medium ${
              profile.role === "admin" ? "text-pink-500" : "text-blue-400"
            }`}
          >
            {profile.role === "admin" ? "Admin Agence" : "VA"}
          </span>
        </div>
      </div>

      {/* Wallet card */}
      {wallet && (
        <div className="p-4 border-b border-border">
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider">
            Balance Agence
          </div>
          <div className="text-xl font-bold text-green-500 mt-1">
            ${wallet.balance.toFixed(2)}
          </div>
          <div className="text-[10px] text-muted-foreground">
            / ${wallet.total_recharged.toFixed(2)}
          </div>
          <div className="h-1 bg-muted rounded mt-2 overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${usagePct}%` }}
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1">
        {navItems
          .filter((item) => item.show)
          .map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-2">
        <div className="flex items-center justify-center">
          <ThemeSwitcher />
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}
