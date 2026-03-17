"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { icon: "🎯", label: "找买家", href: "/buyers", badge: null },
  { icon: "🔗", label: "找供应链", href: "/supply-chain", badge: null },
  { icon: "📡", label: "选品雷达", href: "/radar", badge: "NEW" },
  { icon: "🛡", label: "信任资产", href: "/trust-assets", badge: "NEW" },
  { icon: "💰", label: "价格情报", href: "/pricing", badge: "NEW" },
  { icon: "📋", label: "合规路径", href: "/compliance", badge: "NEW" },
  { icon: "📬", label: "唤醒买家", href: "/reactivation", badge: null },
  { icon: "🎪", label: "展会情报", href: "/trade-show", badge: null },
];

const bottomItems = [
  { icon: "📊", label: "数据概览", href: "/dashboard" },
  { icon: "⚙️", label: "设置", href: "/settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[200px] flex-shrink-0 bg-white border-r border-border flex flex-col h-screen">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">G</span>
          </div>
          <span className="font-semibold text-foreground text-sm">GlobalMatch</span>
        </div>
        <p className="text-xs text-muted mt-1">出海全链路操作系统</p>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto scrollbar-thin">
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors group ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground/70 hover:bg-gray-50 hover:text-foreground"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge && (
                  <span className="text-[10px] bg-warning/15 text-warning px-1.5 py-0.5 rounded font-medium">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-border space-y-0.5">
          {bottomItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground/70 hover:bg-gray-50 hover:text-foreground"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-xs text-primary font-medium">用</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">演示账户</p>
            <p className="text-[10px] text-muted truncate">demo@globalmatch.ai</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
