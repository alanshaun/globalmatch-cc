"use client";

export default function DashboardPage() {
  const stats = [
    { label: "找到买家", value: "—", unit: "家", icon: "🎯", color: "text-primary" },
    { label: "发送邮件", value: "—", unit: "封", icon: "📧", color: "text-success" },
    { label: "邮件打开", value: "—", unit: "%", icon: "👁", color: "text-warning" },
    { label: "已回复", value: "—", unit: "封", icon: "💬", color: "text-purple-600" },
  ];

  return (
    <div className="flex flex-col h-screen">
      <div className="px-6 py-4 border-b border-border bg-white">
        <h1 className="text-lg font-semibold">数据概览</h1>
        <p className="text-sm text-muted">你的出海效果一览</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-4 gap-4 mb-6">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-white border border-border rounded-xl p-5">
                <div className="text-2xl mb-2">{stat.icon}</div>
                <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}<span className="text-lg ml-1">{stat.unit}</span></div>
                <div className="text-sm text-muted mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-border rounded-xl p-6 text-center py-16">
            <div className="text-4xl mb-4">📊</div>
            <h2 className="text-lg font-semibold mb-2">数据正在积累</h2>
            <p className="text-muted text-sm">开始使用找买家功能，数据将在这里统计展示</p>
          </div>
        </div>
      </div>
    </div>
  );
}
