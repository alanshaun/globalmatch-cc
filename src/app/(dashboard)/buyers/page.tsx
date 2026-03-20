"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { SearchModal } from "@/components/buyer/SearchModal";
import { BuyerCard } from "@/components/buyer/BuyerCard";
import { BuyerDetailDrawer } from "@/components/buyer/BuyerDetailDrawer";
import { ErrorBoundary, DrawerErrorBoundary } from "@/components/ErrorBoundary";
import { normalizeBuyerArray } from "@/lib/normalizeBuyer";
import { IntentPopupContainer, useIntentEvents } from "@/components/buyer/IntentPopup";
import { SELLER_PROFILE_KEY } from "@/lib/constants";
import { useJobPoller } from "@/hooks/useJobPoller";
import { apiFetch } from "@/lib/apiClient";
import { JobProgressCard } from "@/components/ui/JobProgressCard";
import type { SellerProfile } from "@/lib/constants";
import type { SupplierWeaknessResult } from "@/services/supplierWeakness";
import type { CompetitorData, SocialDynamics } from "@/services/intelligenceAgent";

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
  // Intelligence Agent fields
  competitorData?: CompetitorData;
  socialDynamics?: SocialDynamics;
  outreachHook?: string;
  reachabilityStatus?: { email: boolean; whatsapp: boolean; linkedin: boolean };
  funnelStage?: string;
}

interface PastSession {
  id: string;
  productName: string;
  targetCountries: string[];
  resultCount: number;
  createdAt: string;
}

type SearchStatus = "idle" | "running" | "completed";
type ScoreFilter = "all" | "high" | "medium" | "low";

const USER_ID = "demo-user";

export default function BuyersPage() {
  const [showModal, setShowModal] = useState(false);
  const [buyers, setBuyers] = useState<BuyerResult[]>([]);
  const [foundCount, setFoundCount] = useState(0);
  const [selectedBuyer, setSelectedBuyer] = useState<BuyerResult | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<PastSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyMsg, setHistoryMsg] = useState("");
  const [savedProfile, setSavedProfile] = useState<SellerProfile | null>(null);
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterIndustry, setFilterIndustry] = useState("all");
  const [filterScore, setFilterScore] = useState<ScoreFilter>("all");

  const [searchErrorDetail, setSearchErrorDetail] = useState<string | null>(null);

  const { toasts, pushEvent, dismiss } = useIntentEvents();

  // Buyer-specific extra polling: also poll intermediate DB results while job runs
  const lastBuyerCount = { current: 0 };

  const { jobStatus, progress, message, errorMsg, jobId: currentJobId, startJob, resumeJob, reset } = useJobPoller({
    jobType: "buyer",
    onFailed: (errMsg) => {
      setSearchErrorDetail(errMsg);
    },
    onCompleted: async (output, jid) => {
      setSearchErrorDetail(null);
      // Load final buyers from DB
      const sid = activeSessionId || (output as { sessionId?: string })?.sessionId;
      if (sid) {
        const { data } = await apiFetch<{ buyers: unknown[] }>(`/api/buyers?sessionId=${sid}&userId=${USER_ID}`);
        if (data?.buyers) {
          const loaded = normalizeBuyerArray(data.buyers);
          loaded.sort((a, b) => b.matchScore - a.matchScore);
          setBuyers(loaded);
          setFoundCount(loaded.length);
        }
      }
      // Refresh sessions list
      apiFetch<{ sessions: PastSession[] }>(`/api/sessions?userId=${USER_ID}`)
        .then(({ data }) => setSessions(data?.sessions || []));
    },
  });

  const isRunning = jobStatus === "starting" || jobStatus === "running";

  // Load saved profile
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SELLER_PROFILE_KEY);
      if (raw) setSavedProfile(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // Load past sessions
  useEffect(() => {
    apiFetch<{ sessions: PastSession[] }>(`/api/sessions?userId=${USER_ID}`)
      .then(({ data }) => setSessions(data?.sessions || []));
  }, []);

  // On mount: auto-resume any running buyer job
  useEffect(() => {
    apiFetch<{ jobs: { id: string; type: string; status: string; progress: number; message: string; sessionId?: string }[] }>(
      `/api/jobs?userId=${USER_ID}`,
      { timeoutMs: 5_000, retries: 1 }
    ).then(({ data }) => {
      const active = data?.jobs?.find(
        (j) => j.type === "buyer" && (j.status === "pending" || j.status === "running")
      );
      if (active) {
        if (active.sessionId) setActiveSessionId(active.sessionId);
        resumeJob(active.id, active.progress, active.message);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll intermediate buyers from DB while job is running
  useEffect(() => {
    if (!isRunning || !activeSessionId) return;
    const id = setInterval(async () => {
      const { data } = await apiFetch<{ buyers: unknown[] }>(
        `/api/buyers?sessionId=${activeSessionId}&userId=${USER_ID}`,
        { timeoutMs: 8_000, retries: 0 }
      );
      if (data?.buyers) {
        const loaded = normalizeBuyerArray(data.buyers);
        if (loaded.length > lastBuyerCount.current) {
          loaded.sort((a, b) => b.matchScore - a.matchScore);
          setBuyers(loaded);
          setFoundCount(loaded.length);
          loaded.slice(lastBuyerCount.current).forEach((b) => {
            if (b.matchScore >= 70) pushEvent({ companyName: b.companyName, event: "new_buyer_found", detail: `匹配度 ${b.matchScore} · ${b.country}` });
          });
          lastBuyerCount.current = loaded.length;
        }
      }
    }, 5_000);
    return () => clearInterval(id);
  }, [isRunning, activeSessionId, pushEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSession = async (sessionId: string) => {
    setLoadingHistory(true);
    setShowHistory(false);
    setActiveSessionId(sessionId);
    setBuyers([]);
    setHistoryMsg("");
    setFilterCountry("all"); setFilterIndustry("all"); setFilterScore("all");

    const { data, ok } = await apiFetch<{ buyers: unknown[] }>(
      `/api/buyers?sessionId=${sessionId}&userId=${USER_ID}`,
      { timeoutMs: 15_000, retries: 2 }
    );
    setLoadingHistory(false);
    if (ok && data?.buyers) {
      const loaded = normalizeBuyerArray(data.buyers);
      setBuyers(loaded.sort((a, b) => b.matchScore - a.matchScore));
      setFoundCount(loaded.length);
      setHistoryMsg(`已加载 ${loaded.length} 家历史买家`);
    } else {
      setHistoryMsg("加载历史记录失败，请重试");
    }
  };

  const handleStageChange = (buyerIdOrDomain: string, stage: string) => {
    setBuyers((prev) => prev.map((b) => b.id === buyerIdOrDomain || b.domain === buyerIdOrDomain ? { ...b, funnelStage: stage } : b));
    apiFetch(`/api/buyers/${buyerIdOrDomain}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ funnelStage: stage }),
      retries: 1,
    } as Parameters<typeof apiFetch>[1]).catch(() => {});
  };

  const handleSearchStart = (params: { productName: string; productDescription: string; targetCountries: string[]; targetCount: number; userId: string }) => {
    setShowModal(false);
    setBuyers([]);
    setFoundCount(0);
    setActiveSessionId(null);
    setSearchErrorDetail(null);
    setFilterCountry("all"); setFilterIndustry("all"); setFilterScore("all");
    lastBuyerCount.current = 0;
    startJob(params);
  };

  // Derived filter options from current buyers
  const countryOptions = useMemo(() => {
    const countries = [...new Set(buyers.map((b) => b.country).filter(Boolean))].sort();
    return countries;
  }, [buyers]);

  const industryOptions = useMemo(() => {
    const industries = [...new Set(buyers.map((b) => b.industry).filter(Boolean))].sort();
    return industries;
  }, [buyers]);

  // Apply filters
  const filteredBuyers = useMemo(() => {
    return buyers.filter((b) => {
      if (filterCountry !== "all" && b.country !== filterCountry) return false;
      if (filterIndustry !== "all" && b.industry !== filterIndustry) return false;
      if (filterScore === "high" && b.matchScore < 75) return false;
      if (filterScore === "medium" && (b.matchScore < 50 || b.matchScore >= 75)) return false;
      if (filterScore === "low" && b.matchScore >= 50) return false;
      return true;
    });
  }, [buyers, filterCountry, filterIndustry, filterScore]);

  const hasActiveFilter = filterCountry !== "all" || filterIndustry !== "all" || filterScore !== "all";

  return (
    <div className="flex flex-col h-screen">
      <IntentPopupContainer toasts={toasts} onDismiss={dismiss} />
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-white flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">生成高意向买家名单</h1>
          <p className="text-sm text-muted">90秒内找到匹配买家 · 含联系人、匹配理由、可发送开发信</p>
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

      {/* Status Bar — running / error */}
      {(isRunning || jobStatus === "error") && (
        <div className="px-6 py-3 border-b border-border">
          <JobProgressCard
            jobStatus={jobStatus}
            progress={progress}
            message={message}
            errorMsg={errorMsg}
            onRetry={() => setShowModal(true)}
            onDismiss={reset}
            idleLabel="正在全网搜索买家..."
          />
          {foundCount > 0 && isRunning && (
            <p className="text-xs text-muted mt-1">已找到 {foundCount} 家，持续搜索中...</p>
          )}
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

      {historyMsg && !loadingHistory && buyers.length > 0 && (
        <div className="px-6 py-2 bg-success/5 border-b border-success/20">
          <p className="text-sm text-success font-medium">✓ {historyMsg}</p>
        </div>
      )}

      {jobStatus === "completed" && buyers.length > 0 && (
        <div className="px-6 py-2 bg-success/5 border-b border-success/20">
          <p className="text-sm text-success font-medium">✓ 已找到 {foundCount} 家匹配买家</p>
        </div>
      )}

      {/* Filter Bar — only visible when there are results */}
      {buyers.length > 0 && (
        <div className="px-6 py-2.5 border-b border-border bg-white flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-muted shrink-0">筛选：</span>

          {/* Country filter */}
          {countryOptions.length > 1 && (
            <select
              value={filterCountry}
              onChange={(e) => setFilterCountry(e.target.value)}
              className={`text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${
                filterCountry !== "all"
                  ? "border-primary bg-primary/5 text-primary font-medium"
                  : "border-border text-foreground"
              }`}
            >
              <option value="all">全部国家</option>
              {countryOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          {/* Industry filter */}
          {industryOptions.length > 1 && (
            <select
              value={filterIndustry}
              onChange={(e) => setFilterIndustry(e.target.value)}
              className={`text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${
                filterIndustry !== "all"
                  ? "border-primary bg-primary/5 text-primary font-medium"
                  : "border-border text-foreground"
              }`}
            >
              <option value="all">全部行业</option>
              {industryOptions.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          )}

          {/* Score filter */}
          <div className="flex items-center gap-1">
            {(["all", "high", "medium", "low"] as ScoreFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilterScore(s)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                  filterScore === s
                    ? "border-primary bg-primary text-white"
                    : "border-border text-foreground hover:bg-gray-50"
                }`}
              >
                {s === "all" ? "全部评分" : s === "high" ? "高匹配 ≥75" : s === "medium" ? "中匹配 50-74" : "低匹配 <50"}
              </button>
            ))}
          </div>

          {/* Active count + reset */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted">
              显示 <span className="font-semibold text-foreground">{filteredBuyers.length}</span> / {buyers.length} 家
            </span>
            {hasActiveFilter && (
              <button
                onClick={() => { setFilterCountry("all"); setFilterIndustry("all"); setFilterScore("all"); }}
                className="text-xs text-primary hover:underline"
              >
                清除筛选
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6" onClick={() => showHistory && setShowHistory(false)}>

        {/* Profile banner */}
        {savedProfile && buyers.length === 0 && jobStatus === "idle" && (
          <div className="mb-4 flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
            <span className="text-xl">✅</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                已读取你的资料：<span className="text-primary">{savedProfile.productName}</span>
                {savedProfile.targetMarkets?.length ? (
                  <span className="text-muted font-normal"> · 目标市场：{savedProfile.targetMarkets.join("、")}</span>
                ) : null}
              </p>
              <p className="text-xs text-muted">点"新建匹配"时信息会自动填入</p>
            </div>
            <Link href="/setup" className="text-xs text-primary hover:underline whitespace-nowrap">修改资料</Link>
          </div>
        )}

        {/* Search error — shown in result area with full error detail */}
        {jobStatus === "error" && buyers.length === 0 && searchErrorDetail && (
          <div className="max-w-2xl mx-auto mt-8">
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <span className="text-red-500 text-xl shrink-0">✕</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-red-700 mb-1">搜索失败</p>
                  <p className="text-xs text-red-600 break-words leading-relaxed">{searchErrorDetail}</p>
                  <p className="text-xs text-red-400 mt-3">
                    可能原因：SearXNG 公开节点暂时不可用，或网络连接受限。请稍后重试，或检查服务器网络配置。
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setShowModal(true)}
                  className="text-xs px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  重新搜索
                </button>
                <button
                  onClick={() => { reset(); setSearchErrorDetail(null); }}
                  className="text-xs px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}

        {jobStatus === "idle" && buyers.length === 0 && (
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
            {/* Empty filter result */}
            {filteredBuyers.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-3xl mb-3">🔍</div>
                <p className="text-sm font-medium text-foreground">没有符合条件的买家</p>
                <p className="text-xs text-muted mt-1">尝试调整筛选条件</p>
                <button
                  onClick={() => { setFilterCountry("all"); setFilterIndustry("all"); setFilterScore("all"); }}
                  className="mt-4 text-sm text-primary hover:underline"
                >
                  清除所有筛选
                </button>
              </div>
            )}

            <div className="columns-1 lg:columns-2 gap-4 space-y-4">
              {filteredBuyers.map((buyer, idx) => (
                <div key={buyer.id || `${buyer.domain}-${idx}`} className="break-inside-avoid">
                  <ErrorBoundary label="买家卡片">
                    <BuyerCard
                      buyer={buyer}
                      onViewDetail={() => setSelectedBuyer(buyer)}
                      onStageChange={handleStageChange}
                    />
                  </ErrorBoundary>
                </div>
              ))}
            </div>
            {isRunning && (
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
