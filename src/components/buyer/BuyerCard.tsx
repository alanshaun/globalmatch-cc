"use client";

import type { BuyerResult } from "@/app/(dashboard)/buyers/page";

interface BuyerCardProps {
  buyer: BuyerResult;
  onViewDetail: () => void;
}

/** SVG circular progress ring */
function ScoreRing({ score }: { score: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 80 ? "#059669" : score >= 60 ? "#1B4FD8" : "#94A3B8";

  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#F1F5F9" strokeWidth="5" />
        <circle
          cx="32" cy="32" r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold leading-none" style={{ color }}>{score}</span>
        <span className="text-[9px] text-slate-400 leading-none mt-0.5">概率</span>
      </div>
    </div>
  );
}

/** Negotiation risk badge derived from matchScore + redFlags */
function getRisk(buyer: BuyerResult) {
  const flags = (buyer.redFlags ?? []).length;
  const s = buyer.matchScore;
  if (flags >= 2 || s < 50)
    return { label: "高谈判风险", bg: "bg-red-50 text-red-600 border-red-200" };
  if (flags === 1 || s < 70)
    return { label: "中谈判风险", bg: "bg-amber-50 text-amber-600 border-amber-200" };
  return { label: "低谈判风险", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

const SIGNAL_ICON: Record<string, string> = {
  funding: "💰",
  product_launch: "📢",
  supplier_change: "🔄",
  hiring: "👥",
  hiring_procurement: "🔥",
  expansion: "📈",
};
const SIGNAL_LABEL: Record<string, string> = {
  funding: "近期融资",
  product_launch: "新品发布",
  supplier_change: "换供应商",
  hiring: "招聘",
  hiring_procurement: "招聘采购",
  expansion: "业务扩张",
};

export function BuyerCard({ buyer, onViewDetail }: BuyerCardProps) {
  const contacts = buyer.contacts ?? [];
  const intentSignals = buyer.intentSignals ?? [];
  const topContact = contacts[0];
  const hotSignals = intentSignals.filter((s) => s.strength === "high").slice(0, 2);
  const risk = getRisk(buyer);
  const initial = buyer.companyName[0]?.toUpperCase() || "?";

  return (
    <div className="group bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-lg hover:border-slate-300 transition-all duration-200 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-start gap-3 mb-4">
        {/* Logo */}
        <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 text-lg font-bold text-slate-400">
          {initial}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-slate-900 leading-snug truncate">
            {buyer.companyName}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {buyer.country}
            {buyer.industry ? ` · ${buyer.industry}` : ""}
            {buyer.shipmentCount > 0 ? " · 进口商" : ""}
          </p>
        </div>

        {/* Score ring */}
        <div className="flex flex-col items-center gap-1">
          <ScoreRing score={buyer.matchScore} />
          <span className="text-[10px] text-slate-400">签单概率</span>
        </div>
      </div>

      {/* ── Badge row ── */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {/* Negotiation risk */}
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${risk.bg}`}>
          {risk.label}
        </span>

        {/* Data source */}
        {buyer.shipmentCount > 0 ? (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
            📦 海关数据
          </span>
        ) : null}

        {/* Email verified */}
        {topContact?.emailQuality === "verified" && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            ✓ 邮箱已验证
          </span>
        )}

        {/* Supplier weakness */}
        {buyer.supplierWeaknessSignal?.hasWeaknessSignal && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
            ⚠ 供应商弱点
          </span>
        )}

        {/* Hot intent signals */}
        {hotSignals.map((sig, i) => (
          <span
            key={i}
            className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200"
          >
            {SIGNAL_ICON[sig.type] || "📌"} {SIGNAL_LABEL[sig.type] || "动态"}
          </span>
        ))}
      </div>

      {/* ── Match reason ── */}
      {buyer.matchReason && (
        <p className="text-sm text-slate-600 leading-relaxed line-clamp-2 mb-3">
          {buyer.matchReason}
        </p>
      )}

      {/* ── Shipment pill ── */}
      {buyer.shipmentCount > 0 && (
        <p className="text-xs text-slate-400 mb-3">
          近12个月进口 <span className="font-semibold text-slate-600">{buyer.shipmentCount}</span> 次
          {buyer.lastShipment ? ` · 最近 ${buyer.lastShipment}` : ""}
        </p>
      )}

      {/* ── Top contact ── */}
      {topContact?.email && (
        <div className="flex items-center gap-2 mb-4 py-2 px-3 bg-slate-50 rounded-lg">
          <span className="text-sm text-slate-700 font-medium truncate">
            {topContact.name || "联系人"}
          </span>
          {topContact.title && (
            <span className="text-xs text-slate-400 shrink-0">· {topContact.title}</span>
          )}
          <span className="ml-auto text-xs text-slate-400 font-mono truncate max-w-[160px]">
            {topContact.email}
          </span>
          {topContact.emailQuality === "verified" && (
            <span className="text-emerald-500 text-xs shrink-0">✓</span>
          )}
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
        <button
          onClick={onViewDetail}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-600 active:scale-[0.98] transition-all duration-150 shadow-sm shadow-primary/20"
        >
          模拟谈判 →
        </button>
        <button
          onClick={onViewDetail}
          className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 active:scale-[0.98] transition-all duration-150"
        >
          详情
        </button>
        <button className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
          ···
        </button>
      </div>
    </div>
  );
}
