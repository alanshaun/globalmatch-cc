"use client";

import { useState } from "react";

interface TradeShowResult {
  showOverview: {
    scale: string;
    exhibitorStructure: string;
    typicalBuyerTypes: string[];
    bestForProducts: string[];
  };
  buyerPersona: {
    title: string;
    company: string;
    painPoints: string[];
    decisionCriteria: string[];
  }[];
  pitch30s: string;
  commonQuestions: { question: string; answer: string }[];
  competitorDisplay: string;
  prepChecklist: string[];
}

const BUYER_TYPE_OPTIONS = ["进口商", "分销商", "零售商", "品牌商", "终端采购", "制造商"];

export default function TradeShowPage() {
  const [showName, setShowName] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [buyerTypes, setBuyerTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TradeShowResult | null>(null);

  const toggleBuyerType = (type: string) =>
    setBuyerTypes((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);

  const handleGenerate = async () => {
    if (!showName.trim() || !productCategory.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/trade-show", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showName, productCategory, buyerTypes }),
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
        <h1 className="text-base font-semibold">展会临门一脚 · 去之前该准备什么</h1>
        <p className="text-sm text-muted">这个展会该见谁、怎么开口、遇到哪些问题如何回答、会后怎么跟进</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border border-border rounded-xl p-6 mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">展会名称 *</label>
              <input
                type="text"
                value={showName}
                onChange={(e) => setShowName(e.target.value)}
                placeholder="如：CES 2026、广交会、Hannover Messe"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">你的产品类别 *</label>
              <input
                type="text"
                value={productCategory}
                onChange={(e) => setProductCategory(e.target.value)}
                placeholder="如：气泵、LED照明、电动工具"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">目标买家类型</label>
              <div className="flex flex-wrap gap-2">
                {BUYER_TYPE_OPTIONS.map((type) => (
                  <button
                    key={type}
                    onClick={() => toggleBuyerType(type)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      buyerTypes.includes(type) ? "bg-primary text-white border-primary" : "border-border hover:border-primary/50"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || !showName.trim() || !productCategory.trim()}
              className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
            >
              {loading ? "正在生成情报包..." : "生成展会情报包 →"}
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-3" />
              <span className="text-muted text-sm">AI正在分析展会数据...</span>
            </div>
          )}

          {result && (
            <div className="space-y-4 animate-fade-in">
              {/* Show Overview */}
              <div className="bg-white border border-border rounded-xl p-5">
                <h3 className="font-semibold mb-3">展会概况</h3>
                <p className="text-sm text-foreground mb-2">{result.showOverview.scale}</p>
                <p className="text-sm text-muted mb-3">{result.showOverview.exhibitorStructure}</p>
                <div className="flex flex-wrap gap-2">
                  {result.showOverview.typicalBuyerTypes.map((type, i) => (
                    <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{type}</span>
                  ))}
                </div>
              </div>

              {/* 30s Pitch */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-primary">30秒展位介绍</h3>
                  <button
                    onClick={() => navigator.clipboard.writeText(result.pitch30s)}
                    className="text-xs text-primary hover:underline"
                  >
                    复制
                  </button>
                </div>
                <p className="text-sm text-foreground italic">"{result.pitch30s}"</p>
              </div>

              {/* Buyer Personas */}
              {result.buyerPersona.length > 0 && (
                <div className="bg-white border border-border rounded-xl p-5">
                  <h3 className="font-semibold mb-3">目标买家画像</h3>
                  <div className="space-y-3">
                    {result.buyerPersona.map((persona, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium">{persona.title} · {persona.company}</p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-muted mb-1">痛点</p>
                            {persona.painPoints.map((p, i) => (
                              <p key={i} className="text-xs text-foreground">• {p}</p>
                            ))}
                          </div>
                          <div>
                            <p className="text-xs text-muted mb-1">决策标准</p>
                            {persona.decisionCriteria.map((c, i) => (
                              <p key={i} className="text-xs text-foreground">✓ {c}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Common Questions */}
              {result.commonQuestions.length > 0 && (
                <div className="bg-white border border-border rounded-xl p-5">
                  <h3 className="font-semibold mb-3">买家常见问题应对</h3>
                  <div className="space-y-3">
                    {result.commonQuestions.map((qa, idx) => (
                      <div key={idx}>
                        <p className="text-sm font-medium text-foreground">Q: {qa.question}</p>
                        <p className="text-sm text-muted mt-1 pl-3">A: {qa.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prep Checklist */}
              <div className="bg-white border border-border rounded-xl p-5">
                <h3 className="font-semibold mb-3">展前准备清单</h3>
                <div className="space-y-2">
                  {result.prepChecklist.map((item, idx) => (
                    <label key={idx} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded text-primary" />
                      <span className="text-sm text-foreground">{item}</span>
                    </label>
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
