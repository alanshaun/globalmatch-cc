"use client";

import { useState, useRef, useCallback } from "react";
import { TARGET_MARKETS } from "@/lib/constants";

interface SearchModalProps {
  onClose: () => void;
  onSearch: (params: {
    productName: string;
    productDescription: string;
    targetCountries: string[];
    targetCount: number;
    userId: string;
    hsCode?: string;
    priceRange?: string;
    moq?: string;
    buyerTypes?: string[];
    excludeKeywords?: string[];
  }) => void;
}

const COUNT_OPTIONS = [10, 20, 30, 50];
const BUYER_TYPE_OPTIONS = ["进口商", "分销商", "零售商", "品牌商", "终端采购"];

type InputMode = "manual" | "file" | "url";

export function SearchModal({ onClose, onSearch }: SearchModalProps) {
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCountries, setSelectedCountries] = useState<string[]>(["美国"]);
  const [targetCount, setTargetCount] = useState(20);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hsCode, setHsCode] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [moq, setMoq] = useState("");
  const [buyerTypes, setBuyerTypes] = useState<string[]>([]);
  const [excludeKeywords, setExcludeKeywords] = useState("");

  // Input mode
  const [inputMode, setInputMode] = useState<InputMode>("manual");

  // File upload state
  const [isDragging, setIsDragging] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [fileError, setFileError] = useState("");
  const [parsedFileName, setParsedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL input state
  const [urlInput, setUrlInput] = useState("");
  const [isParsingUrl, setIsParsingUrl] = useState(false);
  const [urlError, setUrlError] = useState("");

  const toggleCountry = (country: string) => {
    setSelectedCountries((prev) =>
      prev.includes(country) ? prev.filter((c) => c !== country) : [...prev, country]
    );
  };

  const toggleBuyerType = (type: string) => {
    setBuyerTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = () => {
    if (!productName.trim() || selectedCountries.length === 0) return;
    onSearch({
      productName: productName.trim(),
      productDescription: description.trim(),
      targetCountries: selectedCountries,
      targetCount,
      userId: "demo-user",
      hsCode: hsCode.trim() || undefined,
      priceRange: priceRange.trim() || undefined,
      moq: moq.trim() || undefined,
      buyerTypes: buyerTypes.length > 0 ? buyerTypes : undefined,
      excludeKeywords: excludeKeywords.trim()
        ? excludeKeywords.split(",").map((k) => k.trim())
        : undefined,
    });
  };

  const applyParsedProfile = (profile: {
    productName?: string;
    productDescription?: string;
    hsCode?: string;
    priceRange?: string;
  }) => {
    if (profile.productName) setProductName(profile.productName);
    if (profile.productDescription) setDescription(profile.productDescription);
    if (profile.hsCode) setHsCode(profile.hsCode);
    if (profile.priceRange) setPriceRange(profile.priceRange);
    setInputMode("manual");
  };

  // File parsing
  const processFile = useCallback(async (file: File) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    if (!allowed.includes(file.type)) {
      setFileError("仅支持 PDF、Word(.docx)、图片(JPG/PNG/WebP)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError("文件大小不能超过 10MB");
      return;
    }

    setFileError("");
    setIsParsingFile(true);
    setParsedFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse-file", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "解析失败");
      }
      const data = await res.json() as { profile: { productName?: string; productDescription?: string; hsCode?: string; pricePositioning?: string } };
      applyParsedProfile({
        productName: data.profile.productName,
        productDescription: data.profile.productDescription,
        hsCode: data.profile.hsCode,
      });
    } catch (e) {
      setFileError(e instanceof Error ? e.message : "解析失败，请手动填写");
      setIsParsingFile(false);
    } finally {
      setIsParsingFile(false);
    }
  }, []);

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  // URL parsing
  const handleParseUrl = async () => {
    const lines = urlInput
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    setUrlError("");
    setIsParsingUrl(true);

    // Use the first valid URL
    const url = lines[0];
    try {
      const res = await fetch("/api/parse-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "抓取失败");
      }
      const data = await res.json() as { profile: { productName?: string; productDescription?: string; hsCode?: string } };
      applyParsedProfile({
        productName: data.profile.productName,
        productDescription: data.profile.productDescription,
        hsCode: data.profile.hsCode,
      });
    } catch (e) {
      setUrlError(e instanceof Error ? e.message : "无法访问该链接，请手动填写");
    } finally {
      setIsParsingUrl(false);
    }
  };

  const isValid = productName.trim().length >= 2 && selectedCountries.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">新建买家匹配</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Input Mode Tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
            {(["manual", "file", "url"] as InputMode[]).map((mode) => {
              const labels: Record<InputMode, string> = {
                manual: "手动填写",
                file: "上传文件",
                url: "粘贴链接",
              };
              return (
                <button
                  key={mode}
                  onClick={() => setInputMode(mode)}
                  className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    inputMode === mode
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {labels[mode]}
                </button>
              );
            })}
          </div>

          {/* File Upload Mode */}
          {inputMode === "file" && (
            <div className="space-y-3">
              <p className="text-xs text-muted">
                上传产品资料，AI 自动识别并填写产品名称和描述
              </p>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => !isParsingFile && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-gray-50"
                } ${isParsingFile ? "pointer-events-none" : ""}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {isParsingFile ? (
                  <>
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-foreground font-medium">解析中...</p>
                    <p className="text-xs text-muted">{parsedFileName}</p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-2xl">
                      📄
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">
                        拖拽文件到这里，或点击上传
                      </p>
                      <p className="text-xs text-muted mt-1">
                        支持 PDF、Word(.docx)、图片(JPG/PNG/WebP)，最大 10MB
                      </p>
                    </div>
                  </>
                )}
              </div>
              {fileError && (
                <p className="text-xs text-danger bg-danger/5 px-3 py-2 rounded-lg">{fileError}</p>
              )}
              <button
                onClick={() => setInputMode("manual")}
                className="text-xs text-muted hover:text-foreground underline"
              >
                跳过，直接手动填写
              </button>
            </div>
          )}

          {/* URL Mode */}
          {inputMode === "url" && (
            <div className="space-y-3">
              <p className="text-xs text-muted">
                粘贴产品页或公司官网链接，AI 自动提取产品信息填入表单
              </p>
              <textarea
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder={"https://www.yourcompany.com/products/xxx\nhttps://alibaba.com/product/..."}
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none font-mono"
              />
              {urlError && (
                <p className="text-xs text-danger bg-danger/5 px-3 py-2 rounded-lg">{urlError}</p>
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleParseUrl}
                  disabled={!urlInput.trim() || isParsingUrl}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    urlInput.trim() && !isParsingUrl
                      ? "bg-primary text-white hover:bg-primary-600"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {isParsingUrl && (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {isParsingUrl ? "正在抓取..." : "提取产品信息"}
                </button>
                <button
                  onClick={() => setInputMode("manual")}
                  className="text-xs text-muted hover:text-foreground underline"
                >
                  手动填写
                </button>
              </div>
            </div>
          )}

          {/* Manual Form — always shown in manual mode, also shown after parse to review */}
          {inputMode === "manual" && (
            <>
              {/* Product Name */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  产品名称 <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="如：气泵、LED灯、电动工具..."
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  产品描述
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="描述核心功能和优势，有助于AI更精准匹配买家..."
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                />
              </div>

              {/* Target Markets */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  目标市场 <span className="text-danger">*</span>
                  <span className="text-muted font-normal ml-1">（至少选一个）</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {TARGET_MARKETS.map((market) => (
                    <button
                      key={market.value}
                      onClick={() => toggleCountry(market.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        selectedCountries.includes(market.value)
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-foreground border-border hover:border-primary/50"
                      }`}
                    >
                      <span>{market.flag}</span>
                      <span>{market.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Count */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  搜索数量
                </label>
                <div className="flex gap-2">
                  {COUNT_OPTIONS.map((n) => (
                    <button
                      key={n}
                      onClick={() => setTargetCount(n)}
                      className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                        targetCount === n
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-foreground border-border hover:border-primary/50"
                      }`}
                    >
                      {n}家
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Options */}
              <div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <span>{showAdvanced ? "▼" : "▶"}</span>
                  更多筛选
                </button>

                {showAdvanced && (
                  <div className="mt-3 space-y-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        HS编码（选填，填了更精准）
                      </label>
                      <input
                        type="text"
                        value={hsCode}
                        onChange={(e) => setHsCode(e.target.value)}
                        placeholder="如：8414.80"
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        价格区间
                      </label>
                      <input
                        type="text"
                        value={priceRange}
                        onChange={(e) => setPriceRange(e.target.value)}
                        placeholder="如：$5-$20/件"
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        最小起订量 MOQ
                      </label>
                      <input
                        type="text"
                        value={moq}
                        onChange={(e) => setMoq(e.target.value)}
                        placeholder="如：500件"
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground mb-2">
                        目标买家类型（多选）
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {BUYER_TYPE_OPTIONS.map((type) => (
                          <button
                            key={type}
                            onClick={() => toggleBuyerType(type)}
                            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                              buyerTypes.includes(type)
                                ? "bg-primary text-white border-primary"
                                : "bg-white text-foreground border-border"
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        排除关键词（逗号分隔）
                      </label>
                      <input
                        type="text"
                        value={excludeKeywords}
                        onChange={(e) => setExcludeKeywords(e.target.value)}
                        placeholder="如：零售, 个人消费者"
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted">已搜索过的公司不会重复出现</p>
          {inputMode === "manual" ? (
            <button
              onClick={handleSubmit}
              disabled={!isValid}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                isValid
                  ? "bg-primary text-white hover:bg-primary-600"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              开始智能匹配 →
            </button>
          ) : (
            <button
              onClick={() => setInputMode("manual")}
              className="px-5 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              手动填写 →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
