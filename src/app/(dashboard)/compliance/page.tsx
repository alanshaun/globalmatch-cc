"use client";

import { useState } from "react";

const PRODUCT_CATEGORIES = ["电子", "食品", "玩具", "化工", "纺织", "机械", "医疗器械", "其他"];
const TARGET_COUNTRIES = ["美国", "欧盟", "英国", "日本", "澳大利亚", "加拿大", "印度", "中东"];
const CERT_OPTIONS = ["ISO9001", "CE", "FCC", "UL", "FDA", "RoHS", "REACH", "BSCI", "SA8000"];

interface Certification {
  name: string;
  type: "mandatory" | "recommended";
  costMin: number;
  costMax: number;
  months: number;
  difficulty: "简单" | "中等" | "复杂";
  authority: string;
  authorityUrl: string;
  description: string;
  countries: string[];
}

interface ComplianceResult {
  summary: string;
  missingCount: number;
  totalCostMin: number;
  totalCostMax: number;
  totalMonths: number;
  certifications: Certification[];
}

const DIFFICULTY_COLORS = { 简单: "text-success", 中等: "text-warning", 复杂: "text-danger" };

export default function CompliancePage() {
  const [category, setCategory] = useState("");
  const [countries, setCountries] = useState<string[]>(["美国"]);
  const [existing, setExisting] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComplianceResult | null>(null);

  const toggleCountry = (c: string) =>
    setCountries((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  const toggleCert = (c: string) =>
    setExisting((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);

  const handleAnalyze = async () => {
    if (!category || countries.length === 0) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productCategory: category, targetCountries: countries, existingCertifications: existing }),
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
        <h1 className="text-lg font-semibold">合规认证路径</h1>
        <p className="text-sm text-muted">清晰了解进入目标市场需要哪些认证，按最易先做排序</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border border-border rounded-xl p-6 mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">产品大类 *</label>
              <div className="flex flex-wrap gap-2">
                {PRODUCT_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      category === cat ? "bg-primary text-white border-primary" : "border-border hover:border-primary/50"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">目标出口国（多选）</label>
              <div className="flex flex-wrap gap-2">
                {TARGET_COUNTRIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => toggleCountry(c)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      countries.includes(c) ? "bg-primary text-white border-primary" : "border-border"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">已有认证</label>
              <div className="flex flex-wrap gap-2">
                {CERT_OPTIONS.map((cert) => (
                  <button
                    key={cert}
                    onClick={() => toggleCert(cert)}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                      existing.includes(cert) ? "bg-success text-white border-success" : "border-border"
                    }`}
                  >
                    {existing.includes(cert) ? "✓ " : ""}{cert}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={loading || !category || countries.length === 0}
              className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
            >
              {loading ? "正在分析合规路径..." : "生成认证路径 →"}
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-3" />
              <span className="text-muted text-sm">正在分析合规要求...</span>
            </div>
          )}

          {result && (
            <div className="space-y-4 animate-fade-in">
              {/* Summary */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <p className="text-sm text-foreground font-medium">{result.summary}</p>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="text-center">
                    <div className="text-lg font-bold text-primary">{result.missingCount}</div>
                    <div className="text-xs text-muted">还需认证</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-foreground">${result.totalCostMin}-{result.totalCostMax}</div>
                    <div className="text-xs text-muted">预计总费用</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-foreground">{result.totalMonths}月</div>
                    <div className="text-xs text-muted">预计总时间</div>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-white border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-4">认证路径（按最易先做排序）</h3>
                <div className="space-y-3">
                  {result.certifications.map((cert, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                          {idx + 1}
                        </div>
                        {idx < result.certifications.length - 1 && (
                          <div className="w-px flex-1 bg-border mt-1 min-h-4" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{cert.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            cert.type === "mandatory" ? "bg-danger/10 text-danger" : "bg-gray-100 text-muted"
                          }`}>
                            {cert.type === "mandatory" ? "强制" : "推荐"}
                          </span>
                        </div>
                        <p className="text-xs text-muted mb-2">{cert.description}</p>
                        <div className="flex items-center gap-4 text-xs">
                          <span>💰 ${cert.costMin}-{cert.costMax}</span>
                          <span>⏱ {cert.months}个月</span>
                          <span className={DIFFICULTY_COLORS[cert.difficulty]}>
                            {cert.difficulty}
                          </span>
                        </div>
                        {cert.authorityUrl && (
                          <a href={cert.authorityUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline mt-1 block">
                            {cert.authority} →
                          </a>
                        )}
                      </div>
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
