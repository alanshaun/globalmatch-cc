"use client";

import Link from "next/link";

// ── Quick action cards ────────────────────────────────────────────────────────
// Each card shows: where the user is in the workflow + what to do next.
// If there's no data yet, the empty state is a launcher — not a "waiting" page.

const WORKFLOW_STEPS = [
  {
    step: 1,
    icon: "📥",
    title: "导入你的资料",
    desc: "上传官网、产品册或直接粘贴网址，系统自动提取公司能力摘要",
    cta: "立即导入",
    href: "/setup",
    color: "border-slate-200 bg-white",
    ctaColor: "bg-slate-800 text-white hover:bg-slate-700",
    status: "todo",
  },
  {
    step: 2,
    icon: "🎯",
    title: "生成高意向买家名单",
    desc: "90秒内找到50个匹配买家，含联系人、开发信、匹配理由",
    cta: "开始寻找",
    href: "/buyers",
    color: "border-primary/20 bg-primary/5",
    ctaColor: "bg-primary text-white hover:bg-primary/90",
    status: "todo",
  },
  {
    step: 3,
    icon: "🛡",
    title: "生成信任资料包",
    desc: "让买家搜到你时第一眼就觉得靠谱，诊断你缺哪些信任背书",
    cta: "生成资料",
    href: "/trust-assets",
    color: "border-emerald-200 bg-emerald-50/50",
    ctaColor: "bg-emerald-600 text-white hover:bg-emerald-700",
    status: "todo",
  },
  {
    step: 4,
    icon: "📬",
    title: "跟进未回复买家",
    desc: "自动识别7天内未回复的潜在客户，生成个性化唤醒策略",
    cta: "查看跟进",
    href: "/reactivation",
    color: "border-amber-200 bg-amber-50/50",
    ctaColor: "bg-amber-600 text-white hover:bg-amber-700",
    status: "todo",
  },
];

const QUICK_TOOLS = [
  { icon: "💰", label: "我该怎么报价", desc: "价格区间 + 策略建议", href: "/pricing" },
  { icon: "📋", label: "出口认证清单", desc: "必做 vs 建议，周期成本", href: "/compliance" },
  { icon: "📡", label: "选品验证", desc: "哪个品类更适合出海", href: "/radar" },
  { icon: "🎪", label: "展会准备包", desc: "见谁 · 怎么聊 · 后续跟进", href: "/trade-show" },
  { icon: "🔗", label: "找供应链工厂", desc: "全球供应商快速匹配", href: "/supply-chain" },
];

// ── Core metrics (empty state that communicates value) ─────────────────────────
const METRICS = [
  {
    icon: "🎯",
    label: "已找买家",
    value: "—",
    unit: "家",
    tip: "开始第一次搜索后显示",
    color: "text-primary",
  },
  {
    icon: "📨",
    label: "已发开发信",
    value: "—",
    unit: "封",
    tip: "接入邮箱后统计",
    color: "text-emerald-600",
  },
  {
    icon: "👁",
    label: "邮件打开率",
    value: "—",
    unit: "%",
    tip: "发信后实时更新",
    color: "text-amber-600",
  },
  {
    icon: "💬",
    label: "已收到回复",
    value: "—",
    unit: "封",
    tip: "回复后统计",
    color: "text-purple-600",
  },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-screen bg-slate-50/50">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">你好，这是你的出海作战台</h1>
            <p className="text-sm text-muted mt-0.5">按工作流走一遍，90秒内看到第一批高意向买家</p>
          </div>
          <Link
            href="/buyers"
            className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            直接找买家 →
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Metrics row */}
          <div className="grid grid-cols-4 gap-3">
            {METRICS.map((m) => (
              <div key={m.label} className="bg-white border border-border rounded-xl p-4">
                <div className="text-xl mb-2">{m.icon}</div>
                <div className={`text-2xl font-bold ${m.color}`}>
                  {m.value}
                  <span className="text-sm font-normal text-muted ml-1">{m.unit}</span>
                </div>
                <div className="text-xs font-medium text-foreground mt-0.5">{m.label}</div>
                <div className="text-[10px] text-muted mt-1">{m.tip}</div>
              </div>
            ))}
          </div>

          {/* Workflow launcher */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-foreground">主流程 · 从这里开始</h2>
              <span className="text-[10px] text-muted bg-slate-100 px-2 py-0.5 rounded-full">按顺序走效果最好</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {WORKFLOW_STEPS.map((step) => (
                <div
                  key={step.step}
                  className={`border rounded-xl p-4 flex flex-col gap-3 ${step.color}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800/10 text-slate-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                        {step.step}
                      </span>
                      <span className="text-xl">{step.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{step.title}</p>
                      <p className="text-xs text-muted mt-0.5 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                  <Link
                    href={step.href}
                    className={`self-start px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${step.ctaColor}`}
                  >
                    {step.cta} →
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Quick tools */}
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">辅助工具</h2>
            <div className="grid grid-cols-5 gap-2">
              {QUICK_TOOLS.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="bg-white border border-border rounded-xl p-3 hover:border-primary/30 hover:bg-primary/5 transition-all group"
                >
                  <div className="text-xl mb-2">{t.icon}</div>
                  <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors leading-tight">
                    {t.label}
                  </p>
                  <p className="text-[10px] text-muted mt-0.5 leading-tight">{t.desc}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Tip bar */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <p className="text-sm font-medium text-primary">推荐路径</p>
              <p className="text-xs text-foreground/70 mt-0.5">
                先在"导入我的资料"上传官网或产品册 → 点"生成买家名单" → 选好目标市场 → 90秒内看到高意向买家 + 可发送的开发信
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
