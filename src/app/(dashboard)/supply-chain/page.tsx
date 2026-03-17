"use client";

import { useState } from "react";

interface Supplier {
  companyName: string;
  website: string;
  domain: string;
  country: string;
  capability: string;
  complianceScore: number;
  capabilityScore: number;
  commercialScore: number;
  overallScore: number;
  summary: string;
  certifications: string[];
  minOrderQty: string;
  leadTime: string;
}

const REGION_OPTIONS = ["中国优先", "东南亚", "全球"];
const COUNT_OPTIONS = [5, 10, 20];

export default function SupplyChainPage() {
  const [need, setNeed] = useState("");
  const [region, setRegion] = useState("中国优先");
  const [quantity, setQuantity] = useState("");
  const [budget, setBudget] = useState("");
  const [certifications, setCertifications] = useState<string[]>([]);
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const handleSearch = async () => {
    if (!need.trim()) return;
    setLoading(true);
    setSuppliers([]);
    try {
      const res = await fetch("/api/supply-chain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ need, region, quantity, budget, certifications, count }),
      });
      const data = await res.json();
      setSuppliers(data.suppliers || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="px-6 py-4 border-b border-border bg-white">
        <h1 className="text-lg font-semibold">找供应链</h1>
        <p className="text-sm text-muted">描述你的需求，AI为你匹配最合适的供应商</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border border-border rounded-xl p-6 mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">你需要什么 *</label>
              <textarea
                value={need}
                onChange={(e) => setNeed(e.target.value)}
                placeholder="如：我需要气泵用的直流电机，12V，功率50W，每月1000个"
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">目标地区</label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                >
                  {REGION_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">月需求量</label>
                <input
                  type="text"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="如：1000个/月"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">预算范围</label>
              <input
                type="text"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="如：$5-15/件"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {COUNT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      count === n ? "bg-primary text-white border-primary" : "border-border"
                    }`}
                  >
                    {n}家
                  </button>
                ))}
              </div>

              <button
                onClick={handleSearch}
                disabled={loading || !need.trim()}
                className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
              >
                {loading ? "搜索中..." : "开始搜索 →"}
              </button>
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-3" />
              <span className="text-muted text-sm">正在全球搜索供应商...</span>
            </div>
          )}

          {suppliers.map((supplier, idx) => (
            <div key={idx} className="bg-white border border-border rounded-xl p-5 mb-3 animate-fade-in">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{supplier.companyName}</h3>
                  <p className="text-xs text-muted mt-0.5">🌍 {supplier.country} · {supplier.capability}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">{supplier.overallScore}</div>
                  <div className="text-xs text-muted">综合评分</div>
                </div>
              </div>

              <p className="text-sm text-foreground mb-3">{supplier.summary}</p>

              <div className="grid grid-cols-3 gap-3 mb-3">
                {[
                  { label: "能力", score: supplier.capabilityScore },
                  { label: "合规", score: supplier.complianceScore },
                  { label: "商务", score: supplier.commercialScore },
                ].map(({ label, score }) => (
                  <div key={label} className="text-center p-2 bg-gray-50 rounded-lg">
                    <div className="text-sm font-bold text-foreground">{score}</div>
                    <div className="text-xs text-muted">{label}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-4 text-xs text-muted">
                {supplier.minOrderQty && <span>MOQ: {supplier.minOrderQty}</span>}
                {supplier.leadTime && <span>交期: {supplier.leadTime}</span>}
                {supplier.website && (
                  <a
                    href={supplier.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    访问官网 →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
