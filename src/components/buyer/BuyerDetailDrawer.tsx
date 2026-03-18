"use client";

import { useState } from "react";
import type { BuyerResult } from "@/app/(dashboard)/buyers/page";

interface BuyerDetailDrawerProps {
  buyer: BuyerResult;
  onClose: () => void;
}

type TabId = "why" | "contact" | "data" | "risks";

const TABS: { id: TabId; label: string }[] = [
  { id: "why", label: "为什么联系他" },
  { id: "contact", label: "如何联系" },
  { id: "data", label: "市场数据" },
  { id: "risks", label: "注意事项" },
];

function ScoreBar({ label, score, reason }: { label: string; score: number; reason: string }) {
  const color = score >= 80 ? "#059669" : score >= 60 ? "#1B4FD8" : "#64748B";
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-muted">{label}</span>
        <span className="text-sm font-bold" style={{ color }}>{score}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-xs text-muted mt-1">{reason}</p>
    </div>
  );
}

export function BuyerDetailDrawer({ buyer, onClose }: BuyerDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabId>("why");
  const [selectedSubject, setSelectedSubject] = useState<"A" | "B">("A");
  const [editedBody, setEditedBody] = useState(buyer.emailDraft?.body ?? "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Normalize potentially-undefined fields (e.g. when loaded from DB)
  const contacts = buyer.contacts ?? [];
  const intentSignals = buyer.intentSignals ?? [];
  const redFlags = buyer.redFlags ?? [];
  const emailDraft = buyer.emailDraft ?? { subjectA: "", subjectB: "", body: "" };

  const handleSendEmail = async () => {
    const topContact = contacts[0];
    if (!topContact?.email) {
      alert("没有找到联系邮箱");
      return;
    }

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

      if (res.ok) {
        setSent(true);
      }
    } catch {
      alert("发送失败，请重试");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="w-[480px] bg-white shadow-2xl flex flex-col animate-slide-in h-screen">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-foreground">{buyer.companyName}</h2>
            <p className="text-xs text-muted mt-0.5">{buyer.website}</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground text-xl p-1"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-2 mr-3 text-xs border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Tab 1: Why Contact */}
          {activeTab === "why" && (
            <div className="p-5 space-y-4">
              <div>
                <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">买家主营业务</h3>
                <p className="text-sm text-foreground">{buyer.buyerBusiness || "暂无分析"}</p>
              </div>

              <div>
                <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">为什么需要你的产品</h3>
                <p className="text-sm text-foreground">{buyer.whyTheyNeedUs || "分析中..."}</p>
              </div>

              {buyer.supplierWeakness && (
                <div>
                  <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">现有供应商可能的弱点</h3>
                  <p className="text-sm text-foreground">{buyer.supplierWeakness}</p>
                </div>
              )}

              {/* Supplier Weakness Signals */}
              {buyer.supplierWeaknessSignal?.hasWeaknessSignal && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-orange-500 text-base">⚠</span>
                    <h3 className="text-sm font-semibold text-orange-700">供应商弱点信号</h3>
                  </div>
                  <div className="space-y-2 mb-3">
                    {buyer.supplierWeaknessSignal.signals.map((sig, idx) => {
                      const sourceLabel: Record<string, string> = {
                        google: "搜索引擎",
                        news: "新闻",
                        hiring: "招聘",
                      };
                      const confidenceColor: Record<string, string> = {
                        high: "text-red-600 bg-red-50",
                        medium: "text-orange-600 bg-orange-100",
                        low: "text-gray-500 bg-gray-100",
                      };
                      return (
                        <div key={idx} className="bg-white rounded-lg p-3 border border-orange-100">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${confidenceColor[sig.confidence] || "text-gray-500 bg-gray-100"}`}>
                              {sig.confidence === "high" ? "高" : sig.confidence === "medium" ? "中" : "低"}置信
                            </span>
                            <span className="text-xs text-muted">
                              {sourceLabel[sig.source] || sig.source}
                            </span>
                          </div>
                          <p className="text-xs text-foreground">{sig.description}</p>
                        </div>
                      );
                    })}
                  </div>
                  {buyer.supplierWeaknessSignal.opportunitySummary && (
                    <div className="bg-white rounded-lg p-3 border border-orange-200">
                      <p className="text-xs font-medium text-orange-700 mb-1">切入建议</p>
                      <p className="text-xs text-foreground">{buyer.supplierWeaknessSignal.opportunitySummary}</p>
                    </div>
                  )}
                </div>
              )}

              {intentSignals.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">意图信号</h3>
                  <div className="space-y-2">
                    {intentSignals.map((signal, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-3 bg-warning/5 border border-warning/20 rounded-lg">
                        <span className="text-warning">🔔</span>
                        <div>
                          <p className="text-xs font-medium text-warning capitalize">
                            {signal.type.replace("_", " ")} · {signal.strength}
                          </p>
                          <p className="text-xs text-foreground mt-0.5">{signal.description}</p>
                          {signal.date && (
                            <p className="text-xs text-muted mt-0.5">{signal.date}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">最佳联系时机</h3>
                <p className="text-sm text-foreground">{buyer.bestContactTiming}</p>
              </div>
            </div>
          )}

          {/* Tab 2: How to Contact */}
          {activeTab === "contact" && (
            <div className="p-5 space-y-4">
              {/* Contacts */}
              <div>
                <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">联系人</h3>
                {contacts.length > 0 ? (
                  <div className="space-y-2">
                    {contacts.map((contact, idx) => (
                      <div key={idx} className="p-3 border border-border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{contact.name || "未知"}</p>
                            <p className="text-xs text-muted">{contact.title || "联系人"}</p>
                          </div>
                          <span className="text-xs text-muted">#{idx + 1}</span>
                        </div>
                        {contact.email && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-muted">📧</span>
                            <span className="text-xs font-mono">{contact.email}</span>
                            {contact.emailQuality === "verified" && (
                              <span className="text-xs text-success">✓</span>
                            )}
                          </div>
                        )}
                        {contact.linkedinUrl && (
                          <a
                            href={contact.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline block mt-1"
                          >
                            LinkedIn →
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">未找到联系人，建议直接发送到官网邮箱</p>
                )}
              </div>

              {/* Email Draft */}
              <div>
                <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">开发信草稿</h3>

                {/* Subject Selection */}
                <div className="mb-3">
                  <p className="text-xs text-muted mb-2">选择主题行：</p>
                  <div className="space-y-2">
                    {[
                      { id: "A" as const, subject: emailDraft.subjectA },
                      { id: "B" as const, subject: emailDraft.subjectB },
                    ].map(({ id, subject }) => (
                      <label
                        key={id}
                        className={`flex items-start gap-2 p-2 border rounded-lg cursor-pointer transition-colors ${
                          selectedSubject === id ? "border-primary bg-primary/5" : "border-border"
                        }`}
                      >
                        <input
                          type="radio"
                          name="subject"
                          checked={selectedSubject === id}
                          onChange={() => setSelectedSubject(id)}
                          className="mt-0.5"
                        />
                        <div>
                          <span className="text-xs font-medium text-primary mr-1">方案{id}</span>
                          <span className="text-xs text-foreground">{subject}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Body */}
                <textarea
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />

                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => setEditedBody(emailDraft.body)}
                    className="text-xs text-muted hover:text-foreground"
                  >
                    重置
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(editedBody)}
                    className="text-xs text-primary hover:underline"
                  >
                    复制全文
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Market Data */}
          {activeTab === "data" && (
            <div className="p-5 space-y-4">
              {buyer.shipmentCount > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">进口记录</h3>
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <p className="text-2xl font-bold text-primary">{buyer.shipmentCount}</p>
                    <p className="text-xs text-muted">次进口记录</p>
                    {buyer.lastShipment && (
                      <p className="text-xs text-muted mt-1">最近进口：{buyer.lastShipment}</p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-3">四维评分详情</h3>
                <ScoreBar label="契合度" score={buyer.fitScore} reason={buyer.matchReason} />
                <ScoreBar label="意图强度" score={buyer.intentScore} reason={`意图信号：${intentSignals.length} 个`} />
                <ScoreBar label="可达性" score={buyer.reachabilityScore} reason={`联系人：${contacts.length} 个`} />
                <ScoreBar label="数据可信度" score={buyer.confidenceScore} reason={`数据来源：${buyer.dataSource}`} />
              </div>

              <div>
                <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">数据来源</h3>
                <p className="text-sm text-foreground capitalize">{buyer.dataSource}</p>
                {buyer.fromCache && (
                  <p className="text-xs text-warning mt-1">⚠️ 部分数据来自历史缓存</p>
                )}
              </div>
            </div>
          )}

          {/* Tab 4: Risks */}
          {activeTab === "risks" && (
            <div className="p-5 space-y-4">
              {redFlags.length > 0 ? (
                <div>
                  <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">风险提示</h3>
                  <div className="space-y-2">
                    {redFlags.map((flag, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-3 bg-danger/5 border border-danger/20 rounded-lg">
                        <span className="text-danger text-sm">⚠️</span>
                        <p className="text-sm text-foreground">{flag}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-4 bg-success/5 border border-success/20 rounded-lg">
                  <span className="text-success">✓</span>
                  <p className="text-sm text-success">未发现明显风险</p>
                </div>
              )}

              <div>
                <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">联系方式状态</h3>
                {contacts.map((c, idx) => (
                  <div key={idx} className="text-sm text-foreground mb-1">
                    <span className="text-muted">{c.email}：</span>
                    <span className={
                      c.emailQuality === "verified" ? "text-success" :
                      c.emailQuality === "generic" ? "text-warning" : "text-muted"
                    }>
                      {c.emailQuality === "verified" ? "已验证" :
                       c.emailQuality === "generic" ? "通用邮箱（建议找个人邮箱）" :
                       c.emailQuality === "unverified" ? "待验证" : "未找到邮箱"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer - Send Button */}
        <div className="px-5 py-4 border-t border-border">
          {sent ? (
            <div className="text-center text-success font-medium text-sm">
              ✓ 邮件已发送，将追踪打开状态
            </div>
          ) : (
            <button
              onClick={handleSendEmail}
              disabled={sending || contacts.length === 0 || !contacts[0]?.email}
              className={`w-full py-3 rounded-lg text-sm font-medium transition-colors ${
                contacts.length > 0 && contacts[0]?.email
                  ? "bg-primary text-white hover:bg-primary-600"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              {sending ? "发送中..." : "发送开发信"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
