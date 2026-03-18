"use client";

import { useState, useEffect } from "react";
import type { SellerProfile } from "@/app/(dashboard)/setup/page";
import { SELLER_PROFILE_KEY } from "@/app/(dashboard)/setup/page";

interface TrustAssets {
  aboutUs: string;
  linkedinBio: string;
  productTemplate: string;
  caseStudies: { title: string; framework: string }[];
  emailSignature: string;
  tagline: string;
}

const CERT_OPTIONS = ["ISO9001", "ISO14001", "CE", "RoHS", "FCC", "UL", "FDA", "IATF16949", "BSCI", "SA8000"];

function CopyBlock({ label, content }: { label: string; content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        <button
          onClick={handleCopy}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            copied ? "bg-success/10 text-success border-success/30" : "text-primary border-primary/30 hover:bg-primary/5"
          }`}
        >
          {copied ? "✓ 已复制" : "复制"}
        </button>
      </div>
      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{content}</p>
    </div>
  );
}

export default function TrustAssetsPage() {
  const [companyName, setCompanyName] = useState("");
  const [companyNameEn, setCompanyNameEn] = useState("");
  const [products, setProducts] = useState("");
  const [certifications, setCertifications] = useState<string[]>([]);
  const [yearsEstablished, setYearsEstablished] = useState("");
  const [markets, setMarkets] = useState<string[]>(["美国", "欧洲"]);
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<TrustAssets | null>(null);

  // Pre-fill from global seller profile
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SELLER_PROFILE_KEY);
      if (!raw) return;
      const p: SellerProfile = JSON.parse(raw);
      if (p.companyName) setCompanyName(p.companyName);
      if (p.productName) setProducts(p.productName);
      if (p.certifications?.length) setCertifications(p.certifications);
      if (p.targetMarkets?.length) setMarkets(p.targetMarkets);
    } catch { /* ignore */ }
  }, []);

  const toggleCert = (cert: string) => {
    setCertifications((prev) =>
      prev.includes(cert) ? prev.filter((c) => c !== cert) : [...prev, cert]
    );
  };

  const handleGenerate = async () => {
    if (!companyName.trim() || !products.trim()) return;
    setLoading(true);
    setAssets(null);
    try {
      const res = await fetch("/api/trust-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, companyNameEn, products, certifications, yearsEstablished, markets }),
      });
      const data = await res.json();
      setAssets(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="px-6 py-4 border-b border-border bg-white">
        <h1 className="text-base font-semibold">让买家更信你 · 供应商信任资料包</h1>
        <p className="text-sm text-muted">帮你（作为出口商/供应商）生成英文自我介绍、LinkedIn简介、邮件签名 · 买家收到开发信后会 Google 你，这些内容决定第一印象</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          {/* Role clarification banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-3">
            <span className="text-blue-500 text-lg shrink-0">🏭</span>
            <div>
              <p className="text-sm font-medium text-blue-800">这是供应商/出口商专用</p>
              <p className="text-xs text-blue-600 mt-0.5">填写你自己公司的信息，生成向海外买家展示的英文信任材料（不是买家背调）</p>
            </div>
          </div>

          <div className="bg-white border border-border rounded-xl p-6 mb-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">公司名称（中文）*</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="如：宁波明德电子有限公司"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">英文名称</label>
                <input
                  type="text"
                  value={companyNameEn}
                  onChange={(e) => setCompanyNameEn(e.target.value)}
                  placeholder="Ningbo Mingde Electronics"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">主营产品 *</label>
              <input
                type="text"
                value={products}
                onChange={(e) => setProducts(e.target.value)}
                placeholder="如：气泵、空压机、充气工具"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">已有认证</label>
              <div className="flex flex-wrap gap-2">
                {CERT_OPTIONS.map((cert) => (
                  <button
                    key={cert}
                    onClick={() => toggleCert(cert)}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                      certifications.includes(cert)
                        ? "bg-primary text-white border-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {cert}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">成立年份</label>
              <input
                type="text"
                value={yearsEstablished}
                onChange={(e) => setYearsEstablished(e.target.value)}
                placeholder="如：2008"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || !companyName.trim() || !products.trim()}
              className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
            >
              {loading ? "AI 正在生成信任资料包…" : "生成我的信任资料包 + 缺口诊断 →"}
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-3" />
              <span className="text-muted text-sm">AI正在生成专业内容...</span>
            </div>
          )}

          {assets && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                <p className="text-lg font-semibold text-primary">"{assets.tagline}"</p>
                <p className="text-xs text-muted mt-1">公司定位标语</p>
              </div>

              <CopyBlock label="英文官网 About Us" content={assets.aboutUs} />
              <CopyBlock label="LinkedIn 公司简介" content={assets.linkedinBio} />
              <CopyBlock label="产品介绍模板" content={assets.productTemplate} />

              {assets.caseStudies?.map((cs, idx) => (
                <CopyBlock key={idx} label={`客户案例 ${idx + 1}：${cs.title}`} content={cs.framework} />
              ))}

              <CopyBlock label="邮件签名" content={assets.emailSignature} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
