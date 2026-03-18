"use client";

import { useState } from "react";
import type { BuyerResult } from "@/app/(dashboard)/buyers/page";

interface BuyerDetailDrawerProps {
  buyer: BuyerResult;
  onClose: () => void;
}

type TabId = "why" | "negotiate" | "compliance" | "contact" | "data" | "risks";

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: "why",        icon: "🎯", label: "为什么" },
  { id: "negotiate",  icon: "⚔",  label: "谈判策略" },
  { id: "compliance", icon: "📋", label: "合规检查" },
  { id: "contact",    icon: "📧", label: "联系人" },
  { id: "data",       icon: "📊", label: "市场数据" },
  { id: "risks",      icon: "⚠",  label: "风险" },
];

/** Build a WhatsApp/SMS short message for quick outreach */
function buildSmsText(companyName: string, whyTheyNeedUs: string): string {
  const reason = whyTheyNeedUs?.slice(0, 80) || "your sourcing needs";
  return `Hi, I'm a supplier that may help with ${reason.toLowerCase()}. Would love to connect with ${companyName}. Reply to discuss details.`;
}

/** Mini score ring for header */
function MiniRing({ score }: { score: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 80 ? "#059669" : score >= 60 ? "#1B4FD8" : "#94A3B8";
  return (
    <div className="relative w-12 h-12">
      <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#F1F5F9" strokeWidth="4" />
        <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.5s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-bold" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

function ScoreBar({ label, score, reason }: { label: string; score: number; reason: string }) {
  const color = score >= 80 ? "#059669" : score >= 60 ? "#1B4FD8" : "#94A3B8";
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-slate-500">{label}</span>
        <span className="text-sm font-bold" style={{ color }}>{score}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: color, transition: "width 0.6s ease" }} />
      </div>
      <p className="text-xs text-slate-400 mt-1">{reason}</p>
    </div>
  );
}

/** Negotiation strategy derived from buyer data */
function NegotiateTab({ buyer }: { buyer: BuyerResult }) {
  const [smsSent, setSmsSent] = useState(false);
  const signals = buyer.intentSignals ?? [];
  const contacts = buyer.contacts ?? [];
  const hasSWS = buyer.supplierWeaknessSignal?.hasWeaknessSignal;

  const angles: { icon: string; title: string; body: string }[] = [];

  if (hasSWS) {
    angles.push({
      icon: "⚔",
      title: "切入现有供应商痛点",
      body: buyer.supplierWeaknessSignal?.opportunitySummary ||
        "对方供应商存在明显弱点，建议直接切入质量稳定性或交期可靠性话题。",
    });
  }
  if (signals.some((s) => s.type === "funding")) {
    angles.push({
      icon: "💰",
      title: "借力融资扩张节点",
      body: "买家近期完成融资，正处于采购扩张期。建议强调产能弹性和快速交付能力，而非压价竞争。",
    });
  }
  if (signals.some((s) => s.type === "hiring_procurement" || s.type === "hiring")) {
    angles.push({
      icon: "🔥",
      title: "抓住采购决策窗口",
      body: "买家正在招聘采购人员，说明采购决策链在更新。现在联系可能直接影响新采购标准的制定。",
    });
  }
  if (buyer.shipmentCount > 20) {
    angles.push({
      icon: "📦",
      title: "高频进口商，聚焦稳定供应",
      body: `对方进口频次高（近12月${buyer.shipmentCount}次），价格谈判弹性较低，核心差异化应放在供货稳定性和账期灵活性上。`,
    });
  }
  if (angles.length === 0) {
    angles.push({
      icon: "🎯",
      title: "建立品质信任切入",
      body: buyer.whyTheyNeedUs || "建议以产品质量和认证为切入点，先建立样品信任再推进批量合作。",
    });
  }

  const decisionChain = contacts.length > 0
    ? contacts.map((c) => `${c.name || "联系人"}（${c.title || "采购"}）`).join(" → ")
    : "建议先联系官网询盘，确定采购负责人";

  return (
    <div className="p-5 space-y-5">
      {/* Strategy cards */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">谈判切入角度</h3>
        <div className="space-y-3">
          {angles.map((a, i) => (
            <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{a.icon}</span>
                <span className="text-sm font-semibold text-slate-800">{a.title}</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{a.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Decision chain */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">决策链</h3>
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
          <p className="text-sm text-blue-800">{decisionChain}</p>
        </div>
      </div>

      {/* Timing */}
      {buyer.bestContactTiming && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">最佳联系时机</h3>
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <p className="text-sm text-emerald-800">{buyer.bestContactTiming}</p>
          </div>
        </div>
      )}

      {/* One-click SMS / WhatsApp outreach */}
      <div className="pt-1">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">一键发送短信</h3>
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mb-3">
          <p className="text-xs text-slate-500 mb-2 font-medium">短信预览</p>
          <p className="text-xs text-slate-700 leading-relaxed">{buildSmsText(buyer.companyName, buyer.whyTheyNeedUs)}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const msg = encodeURIComponent(buildSmsText(buyer.companyName, buyer.whyTheyNeedUs));
              window.open(`https://wa.me/?text=${msg}`, "_blank");
              setSmsSent(true);
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 active:scale-[0.98] transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            {smsSent ? "已发送 WhatsApp ✓" : "一键发 WhatsApp"}
          </button>
          <button
            onClick={() => {
              const phone = contacts[0]?.email?.includes("@") ? "" : contacts[0]?.email || "";
              const msg = encodeURIComponent(buildSmsText(buyer.companyName, buyer.whyTheyNeedUs));
              window.open(`sms:${phone}?body=${msg}`, "_blank");
            }}
            className="px-4 py-3 rounded-xl text-sm font-semibold bg-slate-700 text-white hover:bg-slate-800 active:scale-[0.98] transition-all shadow-sm"
          >
            📱 短信
          </button>
        </div>
        {smsSent && (
          <p className="text-xs text-emerald-600 text-center mt-2">已打开 WhatsApp，请确认发送</p>
        )}
      </div>
    </div>
  );
}

/** Compliance check tab */
function ComplianceTab({ buyer }: { buyer: BuyerResult }) {
  const country = buyer.country || "目标市场";

  const checks = [
    { label: "出口许可证要求", status: "safe",    note: "一般贸易商品，无需特殊出口许可" },
    { label: "目标国进口关税",  status: "warn",    note: `需核实 ${country} 最新MFN税率及优惠协议` },
    { label: "产品认证要求",    status: "warn",    note: "建议确认当地CE/UL/RoHS等认证是否必需" },
    { label: "出口管制筛查",    status: "pending", note: "EAR/OFAC名单比对（Pro功能）" },
    { label: "HS编码匹配",      status: "pending", note: "AI自动匹配最优HS编码（Pro功能）" },
  ];

  const statusStyles: Record<string, { dot: string; text: string; bg: string }> = {
    safe:    { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
    warn:    { dot: "bg-amber-500",   text: "text-amber-700",   bg: "bg-amber-50 border-amber-200" },
    pending: { dot: "bg-slate-300",   text: "text-slate-500",   bg: "bg-slate-50 border-slate-200" },
  };

  return (
    <div className="p-5 space-y-5">
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
          合规快速筛查 · {country}
        </h3>
        <div className="space-y-2">
          {checks.map((c, i) => {
            const st = statusStyles[c.status];
            return (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${st.bg}`}>
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${st.dot}`} />
                <div>
                  <p className={`text-sm font-medium ${st.text}`}>{c.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{c.note}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pro CTA */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800 to-slate-700 text-white">
        <p className="text-sm font-semibold mb-1">Pro · 一键合规报告</p>
        <p className="text-xs text-slate-300 mb-3">
          自动生成 {country} 完整合规检查清单，包含出口管制名单比对和 HS 编码推荐
        </p>
        <button className="w-full py-2 rounded-lg text-sm font-medium bg-white/15 hover:bg-white/25 transition-colors">
          升级 Pro → 生成 PDF 报告
        </button>
      </div>
    </div>
  );
}

export function BuyerDetailDrawer({ buyer, onClose }: BuyerDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabId>("why");
  const [selectedSubject, setSelectedSubject] = useState<"A" | "B">("A");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Normalize possibly-undefined fields from DB
  const contacts = buyer.contacts ?? [];
  const intentSignals = buyer.intentSignals ?? [];
  const redFlags = buyer.redFlags ?? [];
  const emailDraft = buyer.emailDraft ?? { subjectA: "", subjectB: "", body: "" };
  const [editedBody, setEditedBody] = useState(emailDraft.body);

  const handleSendEmail = async () => {
    const topContact = contacts[0];
    if (!topContact?.email) { alert("没有找到联系邮箱"); return; }
    setSending(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerMatchId: buyer.id || "demo",
          subject: selectedSubject === "A" ? emailDraft.subjectA : emailDraft.subjectB,
          body: editedBody,
          subjectVariant: selectedSubject,
          userId: "demo-user",
        }),
      });
      if (res.ok) setSent(true);
    } catch { alert("发送失败，请重试"); }
    finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="w-[580px] bg-white shadow-2xl flex flex-col h-screen animate-slide-in">

        {/* ── Header ── */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-4">
          <MiniRing score={buyer.matchScore} />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-slate-900 truncate">{buyer.companyName}</h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {buyer.country}
              {buyer.industry ? ` · ${buyer.industry}` : ""}
              {buyer.website ? ` · ${buyer.website}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none p-1 transition-colors">
            ×
          </button>
        </div>

        {/* ── Body: left nav + right content ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left sidebar tabs */}
          <nav className="w-[76px] border-r border-slate-200 bg-slate-50 flex flex-col py-3 gap-1 flex-shrink-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1 py-3 px-1 mx-2 rounded-xl text-center transition-all ${
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="text-lg leading-none">{tab.icon}</span>
                <span className="text-[10px] font-medium leading-tight whitespace-pre-wrap">{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Right content */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">

            {/* Tab: Why */}
            {activeTab === "why" && (
              <div className="p-5 space-y-5">
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">买家主营业务</h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{buyer.buyerBusiness || "暂无分析"}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">为什么需要你的产品</h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{buyer.whyTheyNeedUs || "分析中..."}</p>
                </div>
                {buyer.supplierWeakness && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">现有供应商可能的弱点</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">{buyer.supplierWeakness}</p>
                  </div>
                )}
                {buyer.supplierWeaknessSignal?.hasWeaknessSignal && (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-orange-500 text-base">⚠</span>
                      <h3 className="text-sm font-semibold text-orange-700">供应商弱点信号</h3>
                    </div>
                    <div className="space-y-2 mb-3">
                      {buyer.supplierWeaknessSignal.signals.map((sig, idx) => {
                        const srcLabel: Record<string, string> = { google: "搜索引擎", news: "新闻", hiring: "招聘" };
                        const confColor: Record<string, string> = {
                          high: "text-red-600 bg-red-50", medium: "text-orange-600 bg-orange-100", low: "text-gray-500 bg-gray-100"
                        };
                        return (
                          <div key={idx} className="bg-white rounded-lg p-3 border border-orange-100">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${confColor[sig.confidence] || "text-gray-500 bg-gray-100"}`}>
                                {sig.confidence === "high" ? "高" : sig.confidence === "medium" ? "中" : "低"}置信
                              </span>
                              <span className="text-xs text-slate-400">{srcLabel[sig.source] || sig.source}</span>
                            </div>
                            <p className="text-xs text-slate-700">{sig.description}</p>
                          </div>
                        );
                      })}
                    </div>
                    {buyer.supplierWeaknessSignal.opportunitySummary && (
                      <div className="bg-white rounded-lg p-3 border border-orange-200">
                        <p className="text-xs font-medium text-orange-700 mb-1">切入建议</p>
                        <p className="text-xs text-slate-700">{buyer.supplierWeaknessSignal.opportunitySummary}</p>
                      </div>
                    )}
                  </div>
                )}
                {intentSignals.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">意图信号</h3>
                    <div className="space-y-2">
                      {intentSignals.map((signal, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                          <span className="text-amber-500 text-base">🔔</span>
                          <div>
                            <p className="text-xs font-semibold text-amber-700 capitalize">
                              {signal.type.replace("_", " ")} · {signal.strength}
                            </p>
                            <p className="text-sm text-slate-700 mt-0.5">{signal.description}</p>
                            {signal.date && <p className="text-xs text-slate-400 mt-0.5">{signal.date}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {buyer.bestContactTiming && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">最佳联系时机</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">{buyer.bestContactTiming}</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Negotiate */}
            {activeTab === "negotiate" && <NegotiateTab buyer={buyer} />}

            {/* Tab: Compliance */}
            {activeTab === "compliance" && <ComplianceTab buyer={buyer} />}

            {/* Tab: Contact */}
            {activeTab === "contact" && (
              <div className="p-5 space-y-5">
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">联系人</h3>
                  {contacts.length > 0 ? (
                    <div className="space-y-2">
                      {contacts.map((contact, idx) => (
                        <div key={idx} className="p-4 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{contact.name || "未知"}</p>
                              <p className="text-xs text-slate-400">{contact.title || "联系人"}</p>
                            </div>
                            <span className="text-xs text-slate-300">#{idx + 1}</span>
                          </div>
                          {contact.email && (
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-slate-400">📧</span>
                              <span className="text-xs font-mono text-slate-600">{contact.email}</span>
                              {contact.emailQuality === "verified" && <span className="text-xs text-emerald-500 font-medium">✓ 已验证</span>}
                              {contact.emailQuality === "generic" && <span className="text-xs text-amber-500">通用邮箱</span>}
                            </div>
                          )}
                          {contact.linkedinUrl && (
                            <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline block mt-1">
                              LinkedIn →
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">未找到联系人，建议直接发送到官网邮箱</p>
                  )}
                </div>

                {/* Email draft */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">开发信草稿</h3>
                  <div className="mb-3 space-y-2">
                    {([
                      { id: "A" as const, subject: emailDraft.subjectA },
                      { id: "B" as const, subject: emailDraft.subjectB },
                    ]).map(({ id, subject }) => (
                      <label key={id} className={`flex items-start gap-2.5 p-3 border rounded-xl cursor-pointer transition-all ${
                        selectedSubject === id ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300"
                      }`}>
                        <input type="radio" name="subject" checked={selectedSubject === id}
                          onChange={() => setSelectedSubject(id)} className="mt-0.5" />
                        <div>
                          <span className="text-xs font-semibold text-primary mr-1">方案{id}</span>
                          <span className="text-xs text-slate-700">{subject}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  <textarea
                    value={editedBody}
                    onChange={(e) => setEditedBody(e.target.value)}
                    rows={9}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none text-slate-700 bg-slate-50"
                  />
                  <div className="flex items-center gap-3 mt-2">
                    <button onClick={() => setEditedBody(emailDraft.body)}
                      className="text-xs text-slate-400 hover:text-slate-600 transition-colors">重置</button>
                    <button onClick={() => navigator.clipboard.writeText(editedBody)}
                      className="text-xs text-primary hover:underline">复制全文</button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Market Data */}
            {activeTab === "data" && (
              <div className="p-5 space-y-5">
                {buyer.shipmentCount > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">进口记录</h3>
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                      <p className="text-3xl font-bold text-primary">{buyer.shipmentCount}</p>
                      <p className="text-xs text-slate-400 mt-0.5">次进口记录</p>
                      {buyer.lastShipment && (
                        <p className="text-xs text-slate-400 mt-1">最近进口：{buyer.lastShipment}</p>
                      )}
                    </div>
                  </div>
                )}
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">六维评分</h3>
                  <ScoreBar label="签单概率" score={buyer.matchScore} reason={buyer.matchReason} />
                  <ScoreBar label="契合度" score={buyer.fitScore} reason="产品需求与供给吻合度" />
                  <ScoreBar label="意图强度" score={buyer.intentScore} reason={`意图信号：${intentSignals.length} 个`} />
                  <ScoreBar label="可达性" score={buyer.reachabilityScore} reason={`联系人：${contacts.length} 个`} />
                  <ScoreBar label="数据可信度" score={buyer.confidenceScore} reason={`数据来源：${buyer.dataSource}`} />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">数据来源</h3>
                  <p className="text-sm text-slate-700 capitalize">{buyer.dataSource}</p>
                  {buyer.fromCache && (
                    <p className="text-xs text-amber-500 mt-1">⚠ 部分数据来自历史缓存</p>
                  )}
                </div>
              </div>
            )}

            {/* Tab: Risks */}
            {activeTab === "risks" && (
              <div className="p-5 space-y-5">
                {redFlags.length > 0 ? (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">风险提示</h3>
                    <div className="space-y-2">
                      {redFlags.map((flag, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                          <span className="text-red-500 text-sm">⚠</span>
                          <p className="text-sm text-red-700">{flag}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <span className="text-emerald-500 text-lg">✓</span>
                    <p className="text-sm text-emerald-700 font-medium">未发现明显风险</p>
                  </div>
                )}
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">联系方式状态</h3>
                  {contacts.length === 0 ? (
                    <p className="text-sm text-slate-400">暂无联系人信息</p>
                  ) : contacts.map((c, idx) => (
                    <div key={idx} className="text-sm text-slate-700 mb-2 flex items-center gap-2">
                      <span className="text-slate-400 truncate">{c.email}</span>
                      <span className={
                        c.emailQuality === "verified" ? "text-emerald-500 text-xs font-medium" :
                        c.emailQuality === "generic" ? "text-amber-500 text-xs" : "text-slate-400 text-xs"
                      }>
                        {c.emailQuality === "verified" ? "已验证" :
                         c.emailQuality === "generic" ? "通用邮箱" :
                         c.emailQuality === "unverified" ? "待验证" : "未找到"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50">
          {sent ? (
            <div className="text-center text-emerald-600 font-semibold text-sm">
              ✓ 邮件已发送，将追踪打开状态
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleSendEmail}
                disabled={sending || contacts.length === 0 || !contacts[0]?.email}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
                  contacts.length > 0 && contacts[0]?.email
                    ? "bg-primary text-white hover:bg-primary-600 shadow-sm shadow-primary/20"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                {sending ? "发送中..." : "发送开发信"}
              </button>
              <button
                onClick={() => setActiveTab("negotiate")}
                className="px-4 py-3 rounded-xl text-sm font-semibold bg-slate-700 text-white hover:bg-slate-800 active:scale-[0.98] transition-all shadow-sm"
              >
                ⚔ 谈判策略
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
