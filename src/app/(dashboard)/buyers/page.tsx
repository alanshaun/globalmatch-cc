"use client";

import { useState, useRef, useEffect } from "react";
import { SearchModal } from "@/components/buyer/SearchModal";
import { BuyerCard } from "@/components/buyer/BuyerCard";
import { BuyerDetailDrawer } from "@/components/buyer/BuyerDetailDrawer";
import { ErrorBoundary, DrawerErrorBoundary } from "@/components/ErrorBoundary";
import { normalizeBuyer, normalizeBuyerArray } from "@/lib/normalizeBuyer";
import type { SupplierWeaknessResult } from "@/services/supplierWeakness";

export interface BuyerResult {
  id?: string;
  companyName: string;
  website: string;
  domain: string;
  country: string;
  industry: string;
  matchScore: number;
  matchReason: string;
  buyerBusiness: string;
  whyTheyNeedUs: string;
  supplierWeakness: string;
  contacts: {
    name: string;
    title: string;
    email: string;
    emailQuality: "verified" | "generic" | "unverified" | "none";
    linkedinUrl: string;
  }[];
  intentSignals: {
    type: string;
    strength: string;
    description: string;
    date?: string;
  }[];
  emailDraft: {
    subjectA: string;
    subjectB: string;
    body: string;
  };
  fitScore: number;
  intentScore: number;
  reachabilityScore: number;
  confidenceScore: number;
  dataSource: string;
  fromCache: boolean;
  shipmentCount: number;
  lastShipment: string | null;
  bestContactTiming: string;
  redFlags: string[];
  supplierWeaknessSignal?: SupplierWeaknessResult;
}

interface PastSession {
  id: string;
  productName: string;
  targetCountries: string[];
  resultCount: number;
  createdAt: string;
}

type SearchStatus = "idle" | "running" | "completed";

const USER_ID = "demo-user";

export default function BuyersPage() {
  const [showModal, setShowModal] = useState(false);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [buyers, setBuyers] = useState<BuyerResult[]>([]);
  const [foundCount, setFoundCount] = useState(0);
  const [selectedBuyer, setSelectedBuyer] = useState<BuyerResult | null>(null);
  const [progress, setProgress] = useState(0);
  const buyerCountRef = useRef(0);

  const [sessions, setSessions] = useState<PastSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Load past sessions on mount
  useEffect(() => {
    fetch(`/api/sessions?userId=${USER_ID}`)
      .then((r) => r.json())
      .then((data) => setSessions(data.sessions || []))
      .catch(() => {});
  }, []);

  const loadSession = async (sessionId: string) => {
    setLoadingHistory(true);
    setShowHistory(false);
    setActiveSessionId(sessionId);
    setBuyers([]);
    setStatus("completed");

    try {
      const res = await fetch(`/api/buyers?sessionId=${sessionId}&userId=${USER_ID}`);
      const data = await res.json();
      const loaded: BuyerResult[] = normalizeBuyerArray(data.buyers);
      setBuyers(loaded.sort((a, b) => b.matchScore - a.matchScore));
      setStatusMsg(`已加载 ${loaded.length} 家历史买家`);
      setFoundCount(loaded.length);
    } catch {
      setStatusMsg("加载历史记录失败");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSearchStart = async (params: {
    productName: string;
    productDescription: string;
    targetCountries: string[];
    targetCount: number;
    userId: string;
  }) => {
    setShowModal(false);
    setStatus("running");
    setBuyers([]);
    setFoundCount(0);
    setProgress(0);
    setStatusMsg("正在解析产品信息...");
    buyerCountRef.current = 0;
    setActiveSessionId(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        setStatus("completed");
        setStatusMsg("搜索启动失败，请重试");
        return;
      }

      const body = await res.json();
      const sessionId = body?.sessionId;
      if (!sessionId) {
        setStatus("completed");
        setStatusMsg(body?.error || "搜索启动失败，请重试");
        return;
      }

      setActiveSessionId(sessionId);

      const es = new EventSource(`/api/search/stream?sessionId=${sessionId}&userId=${params.userId}`);

      es.onmessage = (e) => {
        const event = JSON.parse(e.data);

        if (event.type === "progress") {
          setStatusMsg(event.message || "处理中...");
          setProgress(event.progress || 0);
          setFoundCount(event.foundCount || 0);
        } else if (event.type === "new_buyer") {
          setBuyers((prev) => {
            const updated = [...prev, normalizeBuyer(event.data)];
            updated.sort((a, b) => b.matchScore - a.matchScore);
            buyerCountRef.current = updated.length;
            return updated;
          });
          setFoundCount(event.foundCount || 0);
          setProgress(event.progress || 0);
        } else if (event.type === "completed") {
          setStatus("completed");
          setFoundCount(event.foundCount || 0);
          setStatusMsg(`已找到 ${event.foundCount} 家匹配买家`);
          setProgress(100);
          es.close();
          // Refresh sessions list
          fetch(`/api/sessions?userId=${USER_ID}`)
            .then((r) => r.json())
            .then((data) => setSessions(data.sessions || []))
            .catch(() => {});
        } else if (event.type === "error") {
          setStatusMsg(event.message || "搜索完成");
          setStatus("completed");
          es.close();
        }
      };

      es.onerror = () => {
        setStatus("completed");
        setStatusMsg(`已找到 ${buyerCountRef.current} 家匹配买家`);
        es.close();
      };
    } catch {
      setStatus("completed");
      setStatusMsg("搜索遇到问题，请重试");
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-white flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">找买家</h1>
          <p className="text-sm text-muted">AI智能匹配全球真实买家，质量优先</p>
        </div>
        <div className="flex items-center gap-2">
          {/* History button */}
          <div className="relative">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="border border-border text-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-1.5"
            >
              <span>🕐</span>
              历史记录
              {sessions.length > 0 && (
                <span className="ml-1 bg-primary/10 text-primary text-xs px-1.5 rounded-full">
                  {sessions.length}
                </span>
              )}
            </button>

            {showHistory && (
              <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-medium text-foreground">历史搜索记录</p>
                </div>
                {sessions.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted">暂无历史记录</div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {sessions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => loadSession(s.id)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-border/50 transition-colors ${
                          activeSessionId === s.id ? "bg-primary/5" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground truncate max-w-[180px]">
                            {s.productName}
                          </span>
                          <span className="text-xs text-primary font-medium ml-2 shrink-0">
                            {s.resultCount} 家
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted">
                            {s.targetCountries.slice(0, 2).join("、")}
                          </span>
                          <span className="text-xs text-muted">·</span>
                          <span className="text-xs text-muted">
                            {new Date(s.createdAt).toLocaleDateString("zh-CN")}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors flex items-center gap-2"
          >
            <span>+</span>
            新建匹配
          </button>
        </div>
      </div>

      {/* Status Bar */}
      {status === "running" && (
        <div className="px-6 py-3 bg-primary/5 border-b border-primary/20">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-primary font-medium">{statusMsg}</span>
            {foundCount > 0 && (
              <span className="text-sm text-muted ml-auto">已找到 {foundCount} 家</span>
            )}
          </div>
          <div className="mt-2 h-1 bg-primary/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {loadingHistory && (
        <div className="px-6 py-3 bg-primary/5 border-b border-primary/20">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-primary font-medium">正在加载历史记录...</span>
          </div>
        </div>
      )}

      {status === "completed" && buyers.length > 0 && !loadingHistory && (
        <div className="px-6 py-2 bg-success/5 border-b border-success/20">
          <p className="text-sm text-success font-medium">✓ {statusMsg}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6" onClick={() => showHistory && setShowHistory(false)}>
        {status === "idle" && buyers.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-5xl mb-4">🎯</div>
            <h2 className="text-xl font-semibold text-foreground mb-2">开始智能找买家</h2>
            <p className="text-muted text-sm max-w-md mb-6">
              上传产品资料或直接描述产品，AI将从全球海关数据、商业数据库中找到真实的潜在买家
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-primary text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors"
            >
              开始智能匹配 →
            </button>
            {sessions.length > 0 && (
              <div className="mt-8 text-sm text-muted">
                或查看{" "}
                <button
                  className="text-primary hover:underline"
                  onClick={() => setShowHistory(true)}
                >
                  {sessions.length} 条历史搜索记录
                </button>
              </div>
            )}
            <div className="mt-8 grid grid-cols-3 gap-4 text-sm">
              {[
                { icon: "📦", title: "海关贸易数据", desc: "真实进口记录" },
                { icon: "🤖", title: "AI深度分析", desc: "买家意图评分" },
                { icon: "📧", title: "个性化开发信", desc: "非模板，高回复率" },
              ].map((item) => (
                <div key={item.title} className="bg-white border border-border rounded-lg p-4 text-center">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <div className="font-medium text-foreground">{item.title}</div>
                  <div className="text-muted text-xs mt-1">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {buyers.length > 0 && (
          <div className="max-w-5xl mx-auto">
            <div className="columns-1 lg:columns-2 gap-4 space-y-4">
              {buyers.map((buyer, idx) => (
                <div key={buyer.id || `${buyer.domain}-${idx}`} className="break-inside-avoid">
                  <ErrorBoundary label="买家卡片">
                    <BuyerCard
                      buyer={buyer}
                      onViewDetail={() => setSelectedBuyer(buyer)}
                    />
                  </ErrorBoundary>
                </div>
              ))}
            </div>
            {status === "running" && (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-3 text-muted text-sm">
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  正在分析更多买家...
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <SearchModal
          onClose={() => setShowModal(false)}
          onSearch={handleSearchStart}
        />
      )}

      {selectedBuyer && (
        <DrawerErrorBoundary>
          <BuyerDetailDrawer
            buyer={selectedBuyer}
            onClose={() => setSelectedBuyer(null)}
          />
        </DrawerErrorBoundary>
      )}
    </div>
  );
}
