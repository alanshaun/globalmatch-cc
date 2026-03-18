"use client";

import { useState } from "react";
import type { BuyerResult } from "@/app/(dashboard)/buyers/page";

interface BuyerCardProps {
  buyer: BuyerResult;
  onViewDetail: () => void;
  onStageChange?: (buyerId: string, stage: FunnelStage) => void;
}

// ── Funnel Stage ──────────────────────────────────────────────────────────────

type FunnelStage = "discovered" | "contacted" | "interested" | "replied";

const FUNNEL_STAGES: { key: FunnelStage; label: string; icon: string; color: string }[] = [
  { key: "discovered", label: "发现", icon: "🔍", color: "bg-slate-100 text-slate-500" },
  { key: "contacted",  label: "已触达", icon: "✉️", color: "bg-blue-100 text-blue-600" },
  { key: "interested", label: "感兴趣", icon: "💡", color: "bg-amber-100 text-amber-600" },
  { key: "replied",    label: "已回信", icon: "🎉", color: "bg-emerald-100 text-emerald-700" },
];

function FunnelTracker({
  stage,
  onChange,
}: {
  stage: FunnelStage;
  onChange: (s: FunnelStage) => void;
}) {
  const currentIdx = FUNNEL_STAGES.findIndex((s) => s.key === stage);

  return (
    <div className="flex items-center gap-0.5 w-full">
      {FUNNEL_STAGES.map((s, idx) => {
        const isDone = idx <= currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <button
            key={s.key}
            onClick={(e) => { e.stopPropagation(); onChange(s.key); }}
            title={s.label}
            className={`
              flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-semibold rounded
              transition-all duration-200 border
              ${isCurrent
                ? `${s.color} border-current shadow-sm scale-[1.03]`
                : isDone
                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                : "bg-slate-50 text-slate-300 border-slate-100 hover:bg-slate-100 hover:text-slate-500"
              }
            `}
          >
            <span>{s.icon}</span>
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Score Ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 80 ? "#059669" : score >= 60 ? "#1B4FD8" : "#94A3B8";

  return (
    <div className="relative w-14 h-14 flex-shrink-0">
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
        <span className="text-[8px] text-slate-400 leading-none mt-0.5">匹配</span>
      </div>
    </div>
  );
}

// ── Intent Badge ──────────────────────────────────────────────────────────────

const SIGNAL_META: Record<string, { icon: string; label: string }> = {
  funding:             { icon: "💰", label: "融资" },
  product_launch:      { icon: "📢", label: "新品" },
  supplier_change:     { icon: "🔄", label: "换供应商" },
  hiring:              { icon: "👥", label: "招聘" },
  hiring_procurement:  { icon: "🔥", label: "招采购" },
  expansion:           { icon: "📈", label: "扩张" },
};

// ── Quick Action Buttons ──────────────────────────────────────────────────────

interface QuickActionsProps {
  email?: string;
  linkedinUrl?: string;
  companyName: string;
  emailDraft?: { subjectA: string; body: string };
}

function QuickActions({ email, linkedinUrl, companyName, emailDraft }: QuickActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleEmailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!email) return;
    const subject = encodeURIComponent(emailDraft?.subjectA ?? `Partnership Opportunity`);
    const body = encodeURIComponent(emailDraft?.body ?? "");
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank");
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const msg = encodeURIComponent(`Hi, I'd love to explore a partnership with ${companyName}.`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const handleLinkedIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (linkedinUrl) {
      window.open(linkedinUrl, "_blank");
    } else {
      window.open(`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(companyName)}`, "_blank");
    }
  };

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!email) return;
    navigator.clipboard.writeText(email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      {/* Email button */}
      <button
        onClick={handleEmailClick}
        disabled={!email}
        title={email ? `发邮件给 ${email}` : "暂无邮箱"}
        className={`
          flex items-center justify-center w-8 h-8 rounded-lg text-sm transition-all duration-150
          ${email
            ? "bg-blue-50 text-blue-600 hover:bg-blue-100 hover:scale-110 active:scale-95 border border-blue-200"
            : "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed"
          }
        `}
      >
        ✉
      </button>

      {/* Copy email */}
      {email && (
        <button
          onClick={handleCopyEmail}
          title="复制邮箱地址"
          className="flex items-center justify-center w-8 h-8 rounded-lg text-sm bg-slate-50 text-slate-500 hover:bg-slate-100 hover:scale-110 active:scale-95 border border-slate-200 transition-all duration-150"
        >
          {copied ? "✓" : "⎘"}
        </button>
      )}

      {/* WhatsApp */}
      <button
        onClick={handleWhatsApp}
        title="发 WhatsApp"
        className="flex items-center justify-center w-8 h-8 rounded-lg text-sm bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:scale-110 active:scale-95 border border-emerald-200 transition-all duration-150"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </button>

      {/* LinkedIn */}
      <button
        onClick={handleLinkedIn}
        title="查看 LinkedIn"
        className="flex items-center justify-center w-8 h-8 rounded-lg text-sm bg-sky-50 text-sky-600 hover:bg-sky-100 hover:scale-110 active:scale-95 border border-sky-200 transition-all duration-150"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      </button>
    </div>
  );
}

// ── Competitor Intel Strip ────────────────────────────────────────────────────

function CompetitorStrip({ primarySupplier }: { primarySupplier?: string }) {
  if (!primarySupplier || primarySupplier === "Unknown") return null;
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-50 rounded-lg border border-orange-100">
      <span className="text-orange-500 text-xs">⚔</span>
      <span className="text-xs text-orange-700 font-medium">现供应商:</span>
      <span className="text-xs text-orange-600 truncate">{primarySupplier}</span>
    </div>
  );
}

// ── Hook Strip ────────────────────────────────────────────────────────────────

function HookStrip({ hook }: { hook?: string }) {
  if (!hook) return null;
  return (
    <div className="flex items-start gap-2 px-2.5 py-2 bg-violet-50 rounded-lg border border-violet-100">
      <span className="text-violet-500 text-xs mt-0.5 flex-shrink-0">🪝</span>
      <p className="text-xs text-violet-700 leading-relaxed italic">&ldquo;{hook}&rdquo;</p>
    </div>
  );
}

// ── Score Mini Bar ────────────────────────────────────────────────────────────

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-slate-400 w-12 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${value}%`, transition: "width 0.6s ease" }}
        />
      </div>
      <span className="text-[10px] font-semibold text-slate-500 w-6 text-right">{value}</span>
    </div>
  );
}

// ── Main Card ─────────────────────────────────────────────────────────────────

export function BuyerCard({ buyer, onViewDetail, onStageChange }: BuyerCardProps) {
  const contacts = buyer.contacts ?? [];
  const intentSignals = buyer.intentSignals ?? [];
  const topContact = contacts[0];
  const hotSignals = intentSignals.filter((s) => s.strength === "high").slice(0, 2);
  const initial = buyer.companyName[0]?.toUpperCase() || "?";
  const currentStage = (buyer.funnelStage as FunnelStage) || "discovered";

  const handleStageChange = (stage: FunnelStage) => {
    onStageChange?.(buyer.id || buyer.domain, stage);
  };

  return (
    <div className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-xl hover:border-slate-300 transition-all duration-200 animate-fade-in">

      {/* ── Top accent bar based on stage ── */}
      <div className={`h-0.5 w-full ${
        currentStage === "replied"    ? "bg-emerald-400" :
        currentStage === "interested" ? "bg-amber-400" :
        currentStage === "contacted"  ? "bg-blue-400" :
        "bg-slate-200"
      }`} />

      <div className="p-4">

        {/* ── Header row ── */}
        <div className="flex items-start gap-3 mb-3">
          {/* Company logo/initial */}
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0 text-base font-bold text-slate-500 shadow-sm">
            {initial}
          </div>

          {/* Company info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 leading-snug truncate">
              {buyer.companyName}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {buyer.country && (
                <span className="text-[11px] text-slate-400">{buyer.country}</span>
              )}
              {buyer.industry && (
                <span className="text-[11px] text-slate-300">·</span>
              )}
              {buyer.industry && (
                <span className="text-[11px] text-slate-400 truncate max-w-[120px]">{buyer.industry}</span>
              )}
              {buyer.shipmentCount > 0 && (
                <>
                  <span className="text-[11px] text-slate-300">·</span>
                  <span className="text-[11px] text-blue-500 font-medium">📦 {buyer.shipmentCount}票进口</span>
                </>
              )}
            </div>
          </div>

          {/* Score ring */}
          <ScoreRing score={buyer.matchScore} />
        </div>

        {/* ── Intelligence badges ── */}
        <div className="flex flex-wrap gap-1 mb-3">
          {buyer.shipmentCount > 0 && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
              海关数据
            </span>
          )}
          {topContact?.emailQuality === "verified" && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              ✓ 已验证邮箱
            </span>
          )}
          {buyer.supplierWeaknessSignal?.hasWeaknessSignal && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100">
              ⚠ 供应商弱点
            </span>
          )}
          {hotSignals.map((sig, i) => (
            <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
              {SIGNAL_META[sig.type]?.icon || "📌"} {SIGNAL_META[sig.type]?.label || "动态"}
            </span>
          ))}
          {buyer.reachabilityStatus?.linkedin && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-sky-50 text-sky-600 border border-sky-100">
              LinkedIn ✓
            </span>
          )}
        </div>

        {/* ── AI outreach hook ── */}
        <HookStrip hook={buyer.outreachHook} />

        {/* ── Current competitor ── */}
        {!buyer.outreachHook && (
          <CompetitorStrip primarySupplier={buyer.competitorData?.primarySupplier} />
        )}

        {/* ── Match reason (collapsed) ── */}
        {buyer.matchReason && (
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mt-2">
            {buyer.matchReason}
          </p>
        )}

        {/* ── Score bars ── */}
        <div className="mt-3 space-y-1.5">
          <ScoreBar label="意向度" value={buyer.intentScore} color="bg-amber-400" />
          <ScoreBar label="适配度" value={buyer.fitScore} color="bg-blue-400" />
          <ScoreBar label="可达性" value={buyer.reachabilityScore} color="bg-emerald-400" />
        </div>

        {/* ── Top contact row ── */}
        {topContact?.email && (
          <div className="flex items-center gap-2 mt-3 py-2 px-2.5 bg-slate-50 rounded-lg border border-slate-100">
            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
              {topContact.name?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-700 truncate">
                {topContact.name || "联系人"}
                {topContact.title && (
                  <span className="font-normal text-slate-400"> · {topContact.title}</span>
                )}
              </p>
              <p className="text-[10px] text-slate-400 font-mono truncate">{topContact.email}</p>
            </div>
            {topContact.emailQuality === "verified" && (
              <span className="text-emerald-500 text-xs shrink-0">✓</span>
            )}
          </div>
        )}

        {/* ── Quick actions row ── */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <QuickActions
            email={topContact?.email}
            linkedinUrl={topContact?.linkedinUrl}
            companyName={buyer.companyName}
            emailDraft={buyer.emailDraft}
          />

          <button
            onClick={onViewDetail}
            className="ml-2 px-3 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary-600 active:scale-[0.97] transition-all duration-150 shadow-sm shadow-primary/20 whitespace-nowrap"
          >
            详情 →
          </button>
        </div>

        {/* ── Funnel tracker ── */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-100">
          <FunnelTracker stage={currentStage} onChange={handleStageChange} />
        </div>
      </div>
    </div>
  );
}
