"use client";

import type { BuyerResult } from "@/app/(dashboard)/buyers/page";

interface BuyerCardProps {
  buyer: BuyerResult;
  onViewDetail: () => void;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-primary";
  return "text-muted";
}

function getScoreBg(score: number): string {
  if (score >= 80) return "bg-success";
  if (score >= 60) return "bg-primary";
  return "bg-gray-300";
}

function getSignalIcon(type: string): string {
  const icons: Record<string, string> = {
    funding: "💰",
    product_launch: "📢",
    supplier_change: "🔄",
    hiring: "👥",
    hiring_procurement: "🔥",
    expansion: "📈",
  };
  return icons[type] || "📌";
}

function getSignalLabel(type: string): string {
  const labels: Record<string, string> = {
    funding: "近期融资",
    product_launch: "新品发布",
    supplier_change: "换供应商",
    hiring: "招聘",
    hiring_procurement: "招聘采购",
    expansion: "业务扩张",
  };
  return labels[type] || "动态";
}

function getDataSourceBadge(source: string) {
  const badges: Record<string, { label: string; color: string }> = {
    customs: { label: "海关数据", color: "bg-primary/10 text-primary" },
    serpapi: { label: "AI分析", color: "bg-purple-50 text-purple-600" },
    ddg: { label: "AI分析", color: "bg-purple-50 text-purple-600" },
    bing: { label: "AI分析", color: "bg-purple-50 text-purple-600" },
    cache: { label: "缓存数据", color: "bg-gray-100 text-gray-600" },
    pdl: { label: "商业数据库", color: "bg-blue-50 text-blue-600" },
  };
  return badges[source] || { label: source, color: "bg-gray-100 text-gray-600" };
}

function getEmailQualityBadge(quality: string) {
  if (quality === "verified")
    return <span className="text-xs text-success font-medium">✓ 已验证</span>;
  if (quality === "generic")
    return <span className="text-xs text-warning font-medium">通用邮箱</span>;
  if (quality === "unverified")
    return <span className="text-xs text-muted">待验证</span>;
  return null;
}

export function BuyerCard({ buyer, onViewDetail }: BuyerCardProps) {
  const topContact = buyer.contacts[0];
  const topSignals = buyer.intentSignals.filter((s) => s.strength === "high").slice(0, 2);
  const dataSource = getDataSourceBadge(buyer.dataSource);

  return (
    <div className="bg-white border border-border rounded-xl p-5 hover:shadow-md transition-all duration-200 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          {/* Logo placeholder */}
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold text-gray-400">
              {buyer.companyName[0]?.toUpperCase() || "?"}
            </span>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground leading-tight">
              {buyer.companyName}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted">
              <span>🌍 {buyer.country}</span>
              {buyer.industry && (
                <>
                  <span>·</span>
                  <span>{buyer.industry}</span>
                </>
              )}
              {buyer.shipmentCount > 0 && (
                <>
                  <span>·</span>
                  <span>进口商</span>
                </>
              )}
            </div>
          </div>
        </div>
        <button className="text-muted hover:text-warning transition-colors text-lg">♡</button>
      </div>

      {/* Data source badges */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dataSource.color}`}>
          {buyer.shipmentCount > 0 ? "📦 " : ""}
          {buyer.shipmentCount > 0 ? "海关数据" : dataSource.label}
        </span>
        {topContact?.emailQuality === "verified" && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-success/10 text-success">
            ✅ 邮箱已验证
          </span>
        )}
        {buyer.fromCache && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-muted">
            历史缓存
          </span>
        )}
      </div>

      {/* Match Score */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted">匹配度</span>
          <span className={`text-base font-bold ${getScoreColor(buyer.matchScore)}`}>
            {buyer.matchScore}
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${getScoreBg(buyer.matchScore)}`}
            style={{ width: `${buyer.matchScore}%` }}
          />
        </div>
        {buyer.matchReason && (
          <p className="text-xs text-muted mt-1.5 line-clamp-2">{buyer.matchReason}</p>
        )}
      </div>

      {/* Shipment Info */}
      {buyer.shipmentCount > 0 && (
        <p className="text-xs text-muted mb-3">
          📦 近12个月进口{buyer.shipmentCount}次
          {buyer.lastShipment && ` · 最近：${buyer.lastShipment}`}
        </p>
      )}

      {/* Intent Signals + Supplier Weakness Badge */}
      {(topSignals.length > 0 || buyer.supplierWeaknessSignal?.hasWeaknessSignal) && (
        <div className="flex items-center flex-wrap gap-2 mb-3">
          {topSignals.map((signal, idx) => (
            <span
              key={idx}
              className="text-xs bg-warning/15 text-warning px-2 py-1 rounded-md font-medium flex items-center gap-1"
            >
              <span>{getSignalIcon(signal.type)}</span>
              <span>{getSignalLabel(signal.type)}</span>
            </span>
          ))}
          {buyer.supplierWeaknessSignal?.hasWeaknessSignal && (
            <span className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-2 py-1 rounded-md font-medium flex items-center gap-1">
              <span>⚠</span>
              <span>供应商弱点</span>
            </span>
          )}
        </div>
      )}

      {/* Contact */}
      {topContact && topContact.email && (
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground font-medium">
              {topContact.name || "联系人"}
            </span>
            {topContact.title && (
              <span className="text-xs text-muted">· {topContact.title}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted">📧 {topContact.email}</span>
            {getEmailQualityBadge(topContact.emailQuality)}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-border">
        <button
          onClick={onViewDetail}
          className="flex-1 text-center py-1.5 rounded-lg text-sm font-medium text-primary border border-primary/30 hover:bg-primary/5 transition-colors"
        >
          发开发信
        </button>
        <button
          onClick={onViewDetail}
          className="flex-1 text-center py-1.5 rounded-lg text-sm font-medium text-foreground border border-border hover:bg-gray-50 transition-colors"
        >
          查看详情
        </button>
        <button className="p-1.5 text-muted hover:text-foreground">···</button>
      </div>
    </div>
  );
}
