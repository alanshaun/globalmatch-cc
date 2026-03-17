"use client";

import { useState } from "react";
import { TARGET_MARKETS } from "@/lib/constants";

interface Recommendation {
  category: string;
  hsCode: string;
  stars: number;
  marketHeat: number[];
  competitionLevel: "低" | "中" | "高";
  recommendation: "值得做" | "太卷" | "时机未到";
  analysis: string;
  reasoning: string;
  entryBarrier: string;
  typicalBuyer: string;
}

const COMPETITION_COLORS = { 低: "text-success", 中: "text-warning", 高: "text-danger" };
const RECOMMENDATION_COLORS = {
  值得做: "bg-success/10 text-success border-success/30",
  太卷: "bg-danger/10 text-danger border-danger/30",
  时机未到: "bg-warning/10 text-warning border-warning/30",
};

export default function RadarPage() {
  const [capability, setCapability] = useState("");
  const [markets, setMarkets] = useState<string[]>(["美国"]);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const toggleMarket = (m: string) => {
    setMarkets((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const handleAnalyze = async () => {
    if (!capability.trim()) return;
    setLoading(true);
    setRecommendations([]);
    try {
      const res = await fetch("/api/radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capability, markets }),
      });
      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="px-6 py-4 border-b border-border bg-white">
        <h1 className="text-lg font-semibold">选品雷达</h1>
        <p className="text-sm text-muted">告诉AI你能做什么，它帮你找最值得出海的品类</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border border-border rounded-xl p-6 mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">工厂能力 *</label>
              <textarea
                value={capability}
                onChange={(e) => setCapability(e.target.value)}
                placeholder="如：我们做注塑，月产能50万件，有ISO9001认证，主要做塑料外壳和容器类产品"
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">目标出口市场</label>
              <div className="flex flex-wrap gap-2">
                {TARGET_MARKETS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => toggleMarket(m.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      markets.includes(m.value)
                        ? "bg-primary text-white border-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {m.flag} {m.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={loading || !capability.trim()}
              className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
            >
              {loading ? "正在分析市场..." : "开始选品分析 →"}
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-3" />
              <span className="text-muted text-sm">AI正在分析全球市场机会...</span>
            </div>
          )}

          <div className="space-y-4">
            {recommendations.map((rec, idx) => (
              <div key={idx} className="bg-white border border-border rounded-xl p-5 animate-fade-in">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{rec.category}</h3>
                      <span className="text-xs text-muted font-mono">HS {rec.hsCode}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={i < rec.stars ? "text-warning" : "text-gray-200"}>★</span>
                      ))}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border font-medium ${RECOMMENDATION_COLORS[rec.recommendation]}`}>
                    {rec.recommendation}
                  </span>
                </div>

                {/* Market Heat Trend */}
                <div className="mb-3">
                  <p className="text-xs text-muted mb-1.5">近6个月市场热度</p>
                  <div className="flex items-end gap-1 h-12">
                    {(rec.marketHeat || [50, 55, 60, 65, 70, 75]).map((heat, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-primary/20 rounded-sm transition-all"
                        style={{ height: `${heat}%`, backgroundColor: `rgba(27, 79, 216, ${0.2 + heat * 0.006})` }}
                        title={`${heat}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs mb-3">
                  <span>竞争强度：
                    <span className={`font-medium ${COMPETITION_COLORS[rec.competitionLevel]}`}>
                      {rec.competitionLevel}
                    </span>
                  </span>
                  <span className="text-muted">典型买家：{rec.typicalBuyer}</span>
                </div>

                <p className="text-sm text-foreground">{rec.analysis}</p>

                {rec.entryBarrier && (
                  <p className="text-xs text-muted mt-2">⚡ 入场门槛：{rec.entryBarrier}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
