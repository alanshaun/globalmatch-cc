"use client";

/**
 * /setup — Step 1: Import your company profile
 *
 * Users upload their website, product catalog, or type manually.
 * The extracted profile is saved to localStorage and reused across ALL modules.
 * This is the "one-time input" that powers the whole workflow.
 */

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TARGET_MARKETS, SELLER_PROFILE_KEY, SellerProfile } from "@/lib/constants";

type Step = "input" | "review";
type InputMode = "url" | "file" | "manual";

const CERT_OPTIONS = ["ISO9001", "ISO14001", "CE", "RoHS", "FCC", "UL", "FDA", "IATF16949", "BSCI", "SA8000"];

function emptyProfile(): SellerProfile {
  return {
    companyName: "",
    productName: "",
    productDescription: "",
    hsCode: "",
    certifications: [],
    targetMarkets: ["美国"],
    priceRange: "",
    moq: "",
    companyWebsite: "",
    strengths: "",
    savedAt: "",
  };
}

function saveProfile(profile: SellerProfile) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SELLER_PROFILE_KEY, JSON.stringify({ ...profile, savedAt: new Date().toISOString() }));
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [inputMode, setInputMode] = useState<InputMode>("url");
  const [profile, setProfile] = useState<SellerProfile>(emptyProfile);

  // URL state
  const [urlInput, setUrlInput] = useState("");
  const [isParsingUrl, setIsParsingUrl] = useState(false);
  const [urlError, setUrlError] = useState("");

  // File state
  const [isDragging, setIsDragging] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [fileError, setFileError] = useState("");
  const [parsedFileName, setParsedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const applyParsed = (parsed: Partial<SellerProfile>) => {
    setProfile((prev) => ({
      ...prev,
      ...parsed,
      targetMarkets: prev.targetMarkets.length ? prev.targetMarkets : ["美国"],
    }));
    setStep("review");
  };

  const handleParseUrl = async () => {
    if (!urlInput.trim()) return;
    setIsParsingUrl(true);
    setUrlError("");
    try {
      const res = await fetch("/api/parse-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      if (!res.ok) throw new Error("解析失败");
      const data = await res.json();
      applyParsed({
        productName: data.productName || "",
        productDescription: data.productDescription || "",
        hsCode: data.hsCode || "",
        companyWebsite: urlInput.trim(),
        strengths: data.strengths || "",
      });
    } catch {
      setUrlError("网址解析失败，请检查链接或改用手动填写");
    } finally {
      setIsParsingUrl(false);
    }
  };

  const handleFile = useCallback(async (file: File) => {
    const maxSize = 10 * 1024 * 1024;
    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setFileError("仅支持 PDF、Word、JPG、PNG、WebP");
      return;
    }
    if (file.size > maxSize) {
      setFileError("文件不能超过 10MB");
      return;
    }
    setFileError("");
    setIsParsingFile(true);
    setParsedFileName(file.name);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse-file", { method: "POST", body: formData });
      if (!res.ok) throw new Error("解析失败");
      const data = await res.json();
      const p = data.profile || data;
      applyParsed({
        productName: p.productName || "",
        productDescription: p.productDescription || "",
        hsCode: p.hsCode || "",
        strengths: p.strengths || "",
      });
    } catch {
      setFileError("文件解析失败，请换一个文件或改用手动填写");
    } finally {
      setIsParsingFile(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleSave = () => {
    saveProfile(profile);
    router.push("/buyers");
  };

  const toggleCert = (c: string) =>
    setProfile((p) => ({
      ...p,
      certifications: p.certifications.includes(c)
        ? p.certifications.filter((x) => x !== c)
        : [...p.certifications, c],
    }));

  const toggleMarket = (m: string) =>
    setProfile((p) => ({
      ...p,
      targetMarkets: p.targetMarkets.includes(m)
        ? p.targetMarkets.filter((x) => x !== m)
        : [...p.targetMarkets, m],
    }));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-slate-50/50">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-white">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center">1</span>
          <div>
            <h1 className="text-base font-semibold">导入我的资料</h1>
            <p className="text-sm text-muted">一次导入，后续所有模块自动复用 · 无需重复填写</p>
          </div>
        </div>
        {/* Progress */}
        <div className="flex items-center gap-2 mt-3">
          {(["input", "review"] as Step[]).map((s, idx) => (
            <div key={s} className="flex items-center gap-2">
              {idx > 0 && <div className="w-8 h-px bg-slate-200" />}
              <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${step === s ? "bg-primary text-white" : "bg-slate-100 text-slate-400"}`}>
                <span>{idx + 1}</span>
                <span>{idx === 0 ? "上传资料" : "确认信息"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">

          {/* ── Step 1: Input ─────────────────────────────────────────────── */}
          {step === "input" && (
            <div className="bg-white border border-border rounded-2xl overflow-hidden">
              {/* Mode tabs */}
              <div className="flex border-b border-border">
                {(["url", "file", "manual"] as InputMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setInputMode(m)}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                      inputMode === m
                        ? "border-b-2 border-primary text-primary bg-primary/5"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    {m === "url" ? "🌐 粘贴官网" : m === "file" ? "📄 上传文件" : "✏️ 手动填写"}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {/* URL mode */}
                {inputMode === "url" && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-foreground mb-1.5">粘贴你的官网或产品页网址</p>
                      <p className="text-xs text-muted mb-3">系统自动提取：公司介绍、产品信息、认证资质、优势卖点</p>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleParseUrl()}
                          placeholder="https://www.yourcompany.com"
                          className="flex-1 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <button
                          onClick={handleParseUrl}
                          disabled={isParsingUrl || !urlInput.trim()}
                          className="px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                        >
                          {isParsingUrl ? "解析中…" : "开始解析"}
                        </button>
                      </div>
                      {urlError && <p className="text-xs text-red-500 mt-2">{urlError}</p>}
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-xs text-muted space-y-1">
                      <p>✓ 支持企业官网、产品详情页、阿里巴巴店铺页</p>
                      <p>✓ 提取信息后可在下一步手动修改</p>
                      <p>✓ 解析完成自动跳到"确认信息"步骤</p>
                    </div>
                  </div>
                )}

                {/* File mode */}
                {inputMode === "file" && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1.5">上传公司介绍或产品册</p>
                    <p className="text-xs text-muted mb-3">支持 PDF、Word、图片（JPG/PNG），最大 10MB</p>
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                        isDragging ? "border-primary bg-primary/5" : "border-slate-200 hover:border-primary/50 hover:bg-slate-50"
                      }`}
                    >
                      {isParsingFile ? (
                        <div className="space-y-2">
                          <div className="text-3xl animate-bounce">📄</div>
                          <p className="text-sm font-medium text-primary">正在解析 {parsedFileName}…</p>
                          <p className="text-xs text-muted">AI 正在提取产品和公司信息</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-4xl">📤</div>
                          <p className="text-sm font-semibold text-foreground">拖拽或点击上传</p>
                          <p className="text-xs text-muted">PDF · Word · JPG · PNG · WebP</p>
                        </div>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.webp" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                    {fileError && <p className="text-xs text-red-500 mt-2">{fileError}</p>}
                  </div>
                )}

                {/* Manual mode */}
                {inputMode === "manual" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-foreground block mb-1">公司名称</label>
                        <input
                          value={profile.companyName}
                          onChange={(e) => setProfile((p) => ({ ...p, companyName: e.target.value }))}
                          placeholder="例：深圳某某科技有限公司"
                          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-foreground block mb-1">主要产品 <span className="text-red-500">*</span></label>
                        <input
                          value={profile.productName}
                          onChange={(e) => setProfile((p) => ({ ...p, productName: e.target.value }))}
                          placeholder="例：工业用LED灯具"
                          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">产品描述</label>
                      <textarea
                        rows={3}
                        value={profile.productDescription}
                        onChange={(e) => setProfile((p) => ({ ...p, productDescription: e.target.value }))}
                        placeholder="简要描述产品特点、应用场景、核心卖点…"
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-foreground block mb-1">HS 编码（选填）</label>
                        <input
                          value={profile.hsCode}
                          onChange={(e) => setProfile((p) => ({ ...p, hsCode: e.target.value }))}
                          placeholder="例：8541.40"
                          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-foreground block mb-1">官网（选填）</label>
                        <input
                          value={profile.companyWebsite}
                          onChange={(e) => setProfile((p) => ({ ...p, companyWebsite: e.target.value }))}
                          placeholder="https://www.example.com"
                          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => setStep("review")}
                      disabled={!profile.productName.trim()}
                      className="w-full py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      下一步：选目标市场 →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step 2: Review & confirm ──────────────────────────────────── */}
          {step === "review" && (
            <div className="space-y-4">
              {/* Extracted info card */}
              <div className="bg-white border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold">确认提取信息</h2>
                  <button onClick={() => setStep("input")} className="text-xs text-muted hover:text-foreground underline">
                    重新上传
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-muted uppercase tracking-wide block mb-1">公司名称</label>
                      <input
                        value={profile.companyName}
                        onChange={(e) => setProfile((p) => ({ ...p, companyName: e.target.value }))}
                        placeholder="你的公司名"
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted uppercase tracking-wide block mb-1">主要产品 <span className="text-red-400">*</span></label>
                      <input
                        value={profile.productName}
                        onChange={(e) => setProfile((p) => ({ ...p, productName: e.target.value }))}
                        placeholder="核心出口产品"
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted uppercase tracking-wide block mb-1">产品描述</label>
                    <textarea
                      rows={2}
                      value={profile.productDescription}
                      onChange={(e) => setProfile((p) => ({ ...p, productDescription: e.target.value }))}
                      placeholder="产品特点、应用场景、核心卖点…"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted uppercase tracking-wide block mb-1">核心优势 / 卖点</label>
                    <textarea
                      rows={2}
                      value={profile.strengths}
                      onChange={(e) => setProfile((p) => ({ ...p, strengths: e.target.value }))}
                      placeholder="例：10年出口经验，CE/RoHS认证齐全，7天快速交期，OEM/ODM"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-muted uppercase tracking-wide block mb-1">HS 编码</label>
                      <input
                        value={profile.hsCode}
                        onChange={(e) => setProfile((p) => ({ ...p, hsCode: e.target.value }))}
                        placeholder="选填"
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted uppercase tracking-wide block mb-1">报价区间</label>
                      <input
                        value={profile.priceRange}
                        onChange={(e) => setProfile((p) => ({ ...p, priceRange: e.target.value }))}
                        placeholder="例：$50–$200/件"
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted uppercase tracking-wide block mb-1">最小起订量</label>
                      <input
                        value={profile.moq}
                        onChange={(e) => setProfile((p) => ({ ...p, moq: e.target.value }))}
                        placeholder="例：100件"
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>
                  {/* Certifications */}
                  <div>
                    <label className="text-[10px] font-semibold text-muted uppercase tracking-wide block mb-2">已有认证</label>
                    <div className="flex flex-wrap gap-2">
                      {CERT_OPTIONS.map((c) => (
                        <button
                          key={c}
                          onClick={() => toggleCert(c)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                            profile.certifications.includes(c)
                              ? "bg-primary text-white border-primary"
                              : "border-slate-200 text-slate-500 hover:border-primary/50"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Target markets card */}
              <div className="bg-white border border-border rounded-2xl p-5">
                <h2 className="text-sm font-semibold mb-1">目标出口市场 <span className="text-red-400">*</span></h2>
                <p className="text-xs text-muted mb-3">选择你最想开拓的市场，可多选</p>
                <div className="grid grid-cols-3 gap-2">
                  {TARGET_MARKETS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => toggleMarket(m.label)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        profile.targetMarkets.includes(m.label)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-200 text-foreground hover:border-primary/30"
                      }`}
                    >
                      <span>{m.flag}</span>
                      <span className="truncate">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={!profile.productName.trim() || profile.targetMarkets.length === 0}
                  className="flex-1 py-3 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  保存并直接找买家 →
                </button>
                <button
                  onClick={() => { saveProfile(profile); router.push("/dashboard"); }}
                  className="px-5 py-3 border border-border rounded-xl text-sm text-muted hover:text-foreground hover:border-slate-300 transition-colors"
                >
                  保存后回主页
                </button>
              </div>

              {/* What happens next */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-foreground mb-2">保存后，系统将自动：</p>
                <div className="grid grid-cols-2 gap-1.5 text-xs text-muted">
                  <p>✓ 找买家自动填充产品信息</p>
                  <p>✓ 信任资料包使用你的资料生成</p>
                  <p>✓ 价格策略基于你的报价区间分析</p>
                  <p>✓ 认证路径根据你的已有证书规划</p>
                  <p>✓ 开发信自动带入公司卖点</p>
                  <p>✓ 所有模块无需重复填写</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
