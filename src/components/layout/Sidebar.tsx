"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// ── Task-flow navigation ─────────────────────────────────────────────────────
// Structured as a sequential workflow, not a feature list.
// Each step has a number, a task-oriented label, and maps to an existing page.

interface NavItem {
  step?: number;
  icon: string;
  label: string;
  sublabel: string;
  href: string;
}

const WORKFLOW: { section: string; color: string; items: NavItem[] }[] = [
  {
    section: "准备",
    color: "text-slate-400",
    items: [
      {
        step: 1,
        icon: "📥",
        label: "导入我的资料",
        sublabel: "上传官网/产品册",
        href: "/setup",
      },
    ],
  },
  {
    section: "寻找买家",
    color: "text-blue-400",
    items: [
      {
        step: 2,
        icon: "🎯",
        label: "生成买家名单",
        sublabel: "高意向进口商",
        href: "/buyers",
      },
      {
        step: 3,
        icon: "📡",
        label: "选品验证雷达",
        sublabel: "哪个品类更好出",
        href: "/radar",
      },
    ],
  },
  {
    section: "触达成交",
    color: "text-emerald-400",
    items: [
      {
        step: 4,
        icon: "🛡",
        label: "信任资料包",
        sublabel: "让买家更信你",
        href: "/trust-assets",
      },
      {
        step: 5,
        icon: "📬",
        label: "跟进与唤醒",
        sublabel: "7天没回怎么追",
        href: "/reactivation",
      },
    ],
  },
  {
    section: "辅助决策",
    color: "text-amber-400",
    items: [
      {
        step: 6,
        icon: "💰",
        label: "该怎么报价",
        sublabel: "定价策略与区间",
        href: "/pricing",
      },
      {
        step: 7,
        icon: "📋",
        label: "出口认证路径",
        sublabel: "哪些证必须做",
        href: "/compliance",
      },
      {
        step: 8,
        icon: "🎪",
        label: "展会临门一脚",
        sublabel: "现场该见谁怎么聊",
        href: "/trade-show",
      },
    ],
  },
];

const TOOLS: NavItem[] = [
  { icon: "🔗", label: "找供应链", sublabel: "寻找合适工厂", href: "/supply-chain" },
];

const BOTTOM: NavItem[] = [
  { icon: "📊", label: "数据总览", sublabel: "", href: "/dashboard" },
  { icon: "⚙️", label: "设置", sublabel: "", href: "/settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="w-[210px] flex-shrink-0 bg-white border-r border-border flex flex-col h-screen">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">G</span>
          </div>
          <span className="font-semibold text-foreground text-sm">GlobalMatch</span>
        </div>
        <p className="text-[11px] text-muted mt-0.5">出海全链路 · 工作流</p>
      </div>

      {/* Workflow Nav */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto scrollbar-thin">
        {WORKFLOW.map((group) => (
          <div key={group.section} className="mb-1">
            {/* Section label */}
            <p className={`text-[10px] font-semibold uppercase tracking-widest px-3 pt-3 pb-1 ${group.color}`}>
              {group.section}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all group ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-foreground/65 hover:bg-gray-50 hover:text-foreground"
                    }`}
                  >
                    {/* Step badge */}
                    {item.step !== undefined ? (
                      <span
                        className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold border transition-colors ${
                          active
                            ? "bg-primary text-white border-primary"
                            : "border-slate-200 text-slate-400 group-hover:border-slate-300"
                        }`}
                      >
                        {item.step}
                      </span>
                    ) : (
                      <span className="text-sm leading-none w-5 text-center">{item.icon}</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium leading-tight truncate">{item.label}</div>
                      <div className="text-[10px] text-muted leading-tight truncate mt-0.5">{item.sublabel}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Tools (utility, not workflow step) */}
        <div className="mt-1 pt-2 border-t border-border">
          <p className="text-[10px] font-semibold uppercase tracking-widest px-3 pt-1 pb-1 text-slate-300">
            工具
          </p>
          {TOOLS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all text-xs ${
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground/50 hover:bg-gray-50 hover:text-foreground"
                }`}
              >
                <span className="text-sm leading-none w-5 text-center">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Bottom items */}
        <div className="mt-1 pt-2 border-t border-border space-y-0.5">
          {BOTTOM.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all text-xs ${
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground/50 hover:bg-gray-50 hover:text-foreground"
                }`}
              >
                <span className="text-sm leading-none w-5 text-center">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
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
