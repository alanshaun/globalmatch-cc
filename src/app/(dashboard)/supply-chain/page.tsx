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

const REGION_OPTIONS = ["中国优先", "越南", "东南亚（越南/泰国/印尼）", "印度", "东欧", "全球最优"];
const COUNT_OPTIONS = [5, 10, 20, 30, 50];
const CERT_REQ_OPTIONS = ["ISO9001", "CE", "RoHS", "FCC", "UL", "FDA", "BSCI", "SA8000"];

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-foreground w-6 text-right">{score}</span>
    </div>
  );
}

function SupplierCard({ supplier, rank }: { supplier: Supplier; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyWebsite = () => {
    navigator.clipboard.writeText(supplier.website || supplier.domain || "").catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const scoreColor =
    supplier.overallScore >= 80
      ? "text-success bg-success/10 border-success/20"
      : supplier.overallScore >= 60
      ? "text-amber-600 bg-amber-50 border-amber-200"
      : "text-danger bg-danger/10 border-danger/20";

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden animate-fade-in transition-shadow hover:shadow-sm">
      {/* Card Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                {rank}
              </span>
              <h3 className="font-semibold text-foreground truncate">{supplier.companyName}</h3>
            </div>
            <p className="text-xs text-muted">🌍 {supplier.country} · {supplier.capability}</p>
          </div>
          <div className={`flex flex-col items-center px-3 py-1.5 rounded-xl border text-center flex-shrink-0 ${scoreColor}`}>
            <span className="text-xl font-bold leading-none">{supplier.overallScore}</span>
            <span className="text-[10px] font-medium mt-0.5">综合</span>
          </div>
        </div>

        <p className="text-sm text-foreground/80 mt-3 leading-relaxed">{supplier.summary}</p>

        {/* Score bars */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: "能力", score: supplier.capabilityScore, color: "bg-primary" },
            { label: "合规", score: supplier.complianceScore, color: "bg-emerald-500" },
            { label: "商务", score: supplier.commercialScore, color: "bg-amber-500" },
          ].map(({ label, score, color }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted">{label}</span>
              </div>
              <ScoreBar score={score} color={color} />
            </div>
          ))}
        </div>

        {/* Quick info row */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border/50">
          {supplier.minOrderQty && (
            <span className="text-xs text-muted">
              <span className="font-medium text-foreground">MOQ:</span> {supplier.minOrderQty}
            </span>
          )}
          {supplier.leadTime && (
            <span className="text-xs text-muted">
              <span className="font-medium text-foreground">交期:</span> {supplier.leadTime}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {/* Copy website */}
            {(supplier.website || supplier.domain) && (
              <button
                onClick={copyWebsite}
                className="text-xs text-muted hover:text-primary transition-colors"
                title="复制官网地址"
              >
                {copied ? "✓ 已复制" : "复制网址"}
              </button>
            )}
            {/* Visit website */}
            {supplier.website && (
              <a
                href={supplier.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline font-medium"
              >
                访问官网 →
              </a>
            )}
            {/* Expand toggle */}
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-muted hover:text-foreground transition-colors ml-1"
            >
              {expanded ? "收起 ▲" : "详情 ▼"}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-border/50 bg-gray-50/50 px-5 py-4 space-y-3">
          {/* Certifications */}
          {supplier.certifications?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-2">认证资质</p>
              <div className="flex flex-wrap gap-1.5">
                {supplier.certifications.map((cert) => (
                  <span
                    key={cert}
                    className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full"
                  >
                    {cert}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <a
              href={`mailto:?subject=供应商询价 - ${supplier.companyName}&body=你好，我是来自 GlobalMatch 的用户，想了解贵司 ${supplier.capability} 相关产品的报价和交期。官网：${supplier.website || supplier.domain}`}
              className="flex-1 text-center text-xs py-2 border border-primary text-primary rounded-lg hover:bg-primary/5 transition-colors font-medium"
            >
              📧 发送询价邮件
            </a>
            {supplier.website && (
              <a
                href={supplier.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center text-xs py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
              >
                🌐 查看公司主页
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SupplyChainPage() {
  const [need, setNeed] = useState("");
  const [region, setRegion] = useState("中国优先");
  const [quantity, setQuantity] = useState("");
  const [budget, setBudget] = useState("");
  const [certifications, setCertifications] = useState<string[]>([]);
  const [count, setCount] = useState(10);
  const [showCerts, setShowCerts] = useState(false);
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
        <h1 className="text-base font-semibold">找供应链</h1>
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
                <label className="block text-sm font-medium mb-1.5">供应商来源地区</label>
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

            {/* Certification requirements */}
            <div>
              <button
                onClick={() => setShowCerts((v) => !v)}
                className="text-sm text-primary hover:underline flex items-center gap-1 mb-2"
              >
                <span>{showCerts ? "▼" : "▶"}</span>
                认证要求（选填）
              </button>
              {showCerts && (
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
                  {CERT_REQ_OPTIONS.map((cert) => (
                    <button
                      key={cert}
                      onClick={() => setCertifications((prev) =>
                        prev.includes(cert) ? prev.filter((c) => c !== cert) : [...prev, cert]
                      )}
                      className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                        certifications.includes(cert)
                          ? "bg-primary text-white border-primary"
                          : "bg-white border-border hover:border-primary/50"
                      }`}
                    >
                      {cert}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                {COUNT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      count === n ? "bg-primary text-white border-primary" : "border-border hover:bg-gray-50"
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

          {suppliers.length > 0 && (
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-muted">
                找到 <span className="font-semibold text-foreground">{suppliers.length}</span> 家供应商，按综合评分排列
              </p>
            </div>
          )}

          <div className="space-y-3">
            {suppliers.map((supplier, idx) => (
              <SupplierCard key={idx} supplier={supplier} rank={idx + 1} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
