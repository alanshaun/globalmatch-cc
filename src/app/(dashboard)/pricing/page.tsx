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

export default function PricingPage() {
  const [productName, setProductName] = useState("");
  const [myPrice, setMyPrice] = useState("");
  const [market, setMarket] = useState("美国");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PricingResult | null>(null);

  // Pre-fill from global seller profile
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
              {/* Price Overview */}
              <div className="bg-white border border-border rounded-xl p-6">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">${result.marketMin}</div>
                    <div className="text-xs text-muted">市场最低</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">${result.marketMedian}</div>
                    <div className="text-xs text-muted">市场中位</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">${result.marketMax}</div>
                    <div className="text-xs text-muted">市场最高</div>
                  </div>
                </div>

                {myPrice && (
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg mb-4">
                    <p className="text-sm font-medium text-foreground">
                      你的报价 <span className="text-primary font-bold">{myPrice}</span>，{result.myPriceAssessment}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted">价格趋势：</span>
                  <span className={`text-sm font-medium ${TREND_COLORS[result.trend]}`}>
                    {TREND_ICONS[result.trend]} {result.trend === "up" ? "上涨" : result.trend === "down" ? "下跌" : "稳定"}
                  </span>
                  <span className="text-xs text-muted">· {result.trendReason}</span>
                </div>
              </div>

              {/* Price Distribution */}
              <div className="bg-white border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-3">价格分布</h3>
                <div className="space-y-2">
                  {(result.distribution || [10, 25, 35, 20, 10]).map((pct, idx) => {
                    const labels = ["低价段", "中低价", "中价段", "中高价", "高价段"];
                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="text-xs text-muted w-12">{labels[idx]}</span>
                        <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary/60 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted w-8">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Strategies */}
              <div className="bg-white border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-3">AI报价策略建议</h3>
                <div className="space-y-3">
                  {result.strategies.map((strategy, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <span className="text-primary font-bold text-sm mt-0.5">{idx + 1}</span>
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
