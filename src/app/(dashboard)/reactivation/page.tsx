"use client";

import { useState, useEffect } from "react";

interface SilentBuyer {
  id: string;
  companyName: string;
  domain: string;
  sentAt: string;
  isOpened: boolean;
  openCount: number;
  silentDays: number;
  subject: string;
  body: string;
}

interface ReactivationStrategy {
  strategy: string;
  followUpSubject: string;
  followUpBody: string;
  linkedinSuggestion: string;
  bestSendTime: string;
  sendDayOfWeek: string;
}

export default function ReactivationPage() {
  const [buyers, setBuyers] = useState<SilentBuyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SilentBuyer | null>(null);
  const [strategy, setStrategy] = useState<ReactivationStrategy | null>(null);
  const [strategyLoading, setStrategyLoading] = useState(false);

  useEffect(() => {
    fetch("/api/reactivation?userId=demo-user&silentDays=7")
      .then((r) => r.json())
      .then((data) => setBuyers(data.buyers || []))
      .catch(() => setBuyers([]))
      .finally(() => setLoading(false));
  }, []);

  const handleGetStrategy = async (buyer: SilentBuyer) => {
    setSelected(buyer);
    setStrategy(null);
    setStrategyLoading(true);
    try {
      const res = await fetch("/api/reactivation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailId: buyer.id,
          companyName: buyer.companyName,
          isOpened: buyer.isOpened,
          silentDays: buyer.silentDays,
          originalSubject: buyer.subject,
          originalBody: buyer.body,
        }),
      });
      const data = await res.json();
      setStrategy(data);
    } finally {
      setStrategyLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="px-6 py-4 border-b border-border bg-white">
        <h1 className="text-base font-semibold">跟进与唤醒 · 7天没回的客户怎么追</h1>
        <p className="text-sm text-muted">自动识别未回复买家，分层生成个性化跟进策略，一键复制发送</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-3" />
              <span className="text-muted text-sm">加载沉默买家列表...</span>
            </div>
          )}

          {!loading && buyers.length === 0 && (
            <div className="text-center py-16">
              <div className="text-4xl mb-4">📬</div>
              <h2 className="text-lg font-semibold mb-2">暂无沉默买家</h2>
              <p className="text-muted text-sm">当有发出超过7天未回复的邮件时，会在这里显示</p>
            </div>
          )}

          <div className="flex gap-4">
            {/* Left: buyer list */}
            {buyers.length > 0 && (
              <div className="w-72 flex-shrink-0 space-y-2">
                {buyers.map((buyer) => (
                  <div
                    key={buyer.id}
                    onClick={() => handleGetStrategy(buyer)}
                    className={`p-4 border rounded-xl cursor-pointer transition-all ${
                      selected?.id === buyer.id ? "border-primary bg-primary/5" : "border-border bg-white hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm truncate">{buyer.companyName}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        buyer.isOpened ? "bg-warning/10 text-warning" : "bg-gray-100 text-muted"
                      }`}>
                        {buyer.isOpened ? "已打开" : "未打开"}
                      </span>
                    </div>
                    <p className="text-xs text-muted">沉默 {buyer.silentDays} 天</p>
                    {buyer.isOpened && buyer.openCount > 1 && (
                      <p className="text-xs text-primary mt-0.5">打开 {buyer.openCount} 次</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Right: strategy */}
            {selected && (
              <div className="flex-1 bg-white border border-border rounded-xl p-5">
                <h3 className="font-semibold mb-1">{selected.companyName}</h3>
                <p className="text-xs text-muted mb-4">
                  {selected.isOpened ? `已打开 ${selected.openCount} 次，但未回复` : "邮件未打开"}
                  · 沉默 {selected.silentDays} 天
                </p>

                {strategyLoading && (
                  <div className="flex items-center gap-3 py-6">
                    <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <span className="text-muted text-sm">AI正在制定唤醒策略...</span>
                  </div>
                )}

                {strategy && (
                  <div className="space-y-4">
                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <p className="text-xs font-medium text-primary mb-1">策略分析</p>
                      <p className="text-sm text-foreground">{strategy.strategy}</p>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted block mb-1">跟进邮件主题</label>
                      <div className="p-3 border border-border rounded-lg">
                        <p className="text-sm font-medium">{strategy.followUpSubject}</p>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-muted">跟进邮件内容</label>
                        <button
                          onClick={() => navigator.clipboard.writeText(strategy.followUpBody)}
                          className="text-xs text-primary hover:underline"
                        >
                          复制
                        </button>
                      </div>
                      <div className="p-3 border border-border rounded-lg">
                        <p className="text-sm text-foreground whitespace-pre-wrap">{strategy.followUpBody}</p>
                      </div>
                    </div>

                    {strategy.linkedinSuggestion && (
                      <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                        <p className="text-xs font-medium text-blue-600 mb-1">💼 LinkedIn 软性曝光建议</p>
                        <p className="text-sm text-foreground">{strategy.linkedinSuggestion}</p>
                      </div>
                    )}

                    <div className="text-xs text-muted">
                      ⏰ 建议发送时间：{strategy.bestSendTime} · {strategy.sendDayOfWeek}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
