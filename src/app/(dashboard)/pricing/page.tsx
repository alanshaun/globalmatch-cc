"use client";

import { useState, useEffect } from "react";
import { TARGET_MARKETS } from "@/lib/constants";
import type { SellerProfile } from "@/app/(dashboard)/setup/page";
import { SELLER_PROFILE_KEY } from "@/app/(dashboard)/setup/page";

interface PricingResult {
  marketMin: number;
  marketMax: number;
  marketMedian: number;
  trend: "up" | "down" | "stable";
  trendReason: string;
  distribution: number[];
  strategies: string[];
  positioning: string;
  myPriceAssessment: string;
}

const TREND_ICONS = { up: "↑", down: "↓", stable: "→" };
const TREND_COLORS = { up: "text-success", down: "text-danger", stable: "text-muted" };
const TREND_BG = { up: "bg-success/10 text-success border-success/20", down: "bg-danger/10 text-danger border-danger/20", stable: "bg-gray-100 text-muted border-border" };

const SEGMENT_LABELS = ["低价段", "中低价", "中价段", "中高价", "高价段"];
const SEGMENT_COLORS = [
  "bg-blue-300",
  "bg-blue-400",
  "bg-primary",
  "bg-blue-600",
  "bg-blue-800",
];

function parsePrice(price: string): number | null {
  const match = price.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : null;
}

export default function PricingPage() {
  const [productName, setProductName] = useState("");
  const [myPrice, setMyPrice] = useState("");
  const [market, setMarket] = useState("美国");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PricingResult | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SELLER_PROFILE_KEY);
      if (!raw) return;
      const p: SellerProfile = JSON.parse(raw);
      if (p.productName) setProductName(p.productName);
      if (p.priceRange) setMyPrice(p.priceRange);
      if (p.targetMarkets?.[0]) setMarket(p.targetMarkets[0]);
    } catch { /* ignore */ }
  }, []);

  const handleAnalyze = async () => {
    if (!productName.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName, myPrice, market }),
      });
      const data = await res.json();
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  // Compute my price position within [min, max] range (0–100%)
  const myPriceNum = myPrice ? parsePrice(myPrice) : null;
  const myPricePosition =
    result && myPriceNum !== null && result.marketMax > result.marketMin
      ? Math.min(
          100,
          Math.max(
            0,
            ((myPriceNum - result.marketMin) / (result.marketMax - result.marketMin)) * 100
          )
        )
      : null;

  return (
    <div className="flex flex-col h-screen">
      <div className="px-6 py-4 border-b border-border bg-white">
        <h1 className="text-base font-semibold">我该怎么报价 · 价格策略分析</h1>
        <p className="text-sm text-muted">看市场价格带分布，判断你报高了还是低了，给出建议报价策略</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border border-border rounded-xl p-6 mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">产品名称 *</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="如：气泵、充气枪、直流电机"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">我的报价（选填）</label>
                <input
                  type="text"
                  value={myPrice}
                  onChange={(e) => setMyPrice(e.target.value)}
                  placeholder="如：$12.5/件"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">目标市场</label>
                <select
                  value={market}
                  onChange={(e) => setMarket(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                >
                  {TARGET_MARKETS.map((m) => (
                    <option key={m.value} value={m.value}>{m.flag} {m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={loading || !productName.trim()}
              className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
            >
              {loading ? "正在分析市场价格…" : "分析报价策略 →"}
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-3" />
              <span className="text-muted text-sm">正在收集市场价格数据...</span>
            </div>
          )}

          {result && (
            <div className="space-y-4 animate-fade-in">
              {/* Price Overview Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border border-border rounded-xl p-4 text-center">
                  <div className="text-xs text-muted mb-1">市场最低</div>
                  <div className="text-xl font-bold text-foreground">${result.marketMin}</div>
                </div>
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                  <div className="text-xs text-muted mb-1">市场中位</div>
                  <div className="text-2xl font-bold text-primary">${result.marketMedian}</div>
                  <div className="text-[10px] text-muted mt-0.5">参考基准</div>
                </div>
                <div className="bg-white border border-border rounded-xl p-4 text-center">
                  <div className="text-xs text-muted mb-1">市场最高</div>
                  <div className="text-xl font-bold text-foreground">${result.marketMax}</div>
                </div>
              </div>

              {/* Visual Price Range Bar */}
              <div className="bg-white border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">价格区间分布</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TREND_BG[result.trend]}`}>
                    {TREND_ICONS[result.trend]} {result.trend === "up" ? "价格上涨" : result.trend === "down" ? "价格下跌" : "价格稳定"}
                  </span>
                </div>

                {/* Gradient range bar */}
                <div className="relative mb-6">
                  <div className="h-8 rounded-full bg-gradient-to-r from-blue-200 via-primary to-blue-800 relative overflow-visible">
                    {/* Median marker */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-0.5 h-10 bg-white/70"
                      style={{
                        left: `${((result.marketMedian - result.marketMin) / (result.marketMax - result.marketMin)) * 100}%`,
                      }}
                    />
                    {/* My price marker */}
                    {myPricePosition !== null && (
                      <div
                        className="absolute -top-2 -translate-x-1/2"
                        style={{ left: `${myPricePosition}%` }}
                      >
                        <div className="w-4 h-4 rounded-full bg-white border-2 border-amber-500 shadow-md" />
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          你的报价
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Labels below bar */}
                  <div className="flex justify-between mt-2 text-xs text-muted">
                    <span>${result.marketMin}</span>
                    <span className="text-primary font-medium">中位 ${result.marketMedian}</span>
                    <span>${result.marketMax}</span>
                  </div>
                </div>

                {/* Segment breakdown */}
                <div className="space-y-2">
                  {(result.distribution || [10, 25, 35, 20, 10]).map((pct, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${SEGMENT_COLORS[idx]} flex-shrink-0`} />
                      <span className="text-xs text-muted w-14">{SEGMENT_LABELS[idx]}</span>
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${SEGMENT_COLORS[idx]} rounded-full transition-all duration-700`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-foreground w-8 text-right">{pct}%</span>
                    </div>
                  ))}
                </div>

                {result.trendReason && (
                  <p className="text-xs text-muted mt-3 pt-3 border-t border-border">{result.trendReason}</p>
                )}
              </div>

              {/* My price assessment */}
              {myPrice && result.myPriceAssessment && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <span className="text-xl">💰</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      你的报价 <span className="text-primary font-bold">{myPrice}</span>
                    </p>
                    <p className="text-sm text-foreground/80 mt-0.5">{result.myPriceAssessment}</p>
                  </div>
                </div>
              )}

              {/* Strategies */}
              <div className="bg-white border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-3">AI 报价策略建议</h3>
                <div className="space-y-3">
                  {result.strategies.map((strategy, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <p className="text-sm text-foreground">{strategy}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
