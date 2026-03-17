"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [kimiKey, setKimiKey] = useState(process.env.NEXT_PUBLIC_BASE_URL ? "" : "");
  const [fromEmail, setFromEmail] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="px-6 py-4 border-b border-border bg-white">
        <h1 className="text-lg font-semibold">设置</h1>
        <p className="text-sm text-muted">配置API密钥和邮件设置</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-xl mx-auto space-y-6">
          <div className="bg-white border border-border rounded-xl p-5">
            <h2 className="font-semibold mb-4">API 配置</h2>
            <div className="space-y-3">
              {[
                { label: "Kimi API Key", placeholder: "sk-..." },
                { label: "Gemini API Key", placeholder: "AIza..." },
                { label: "SerpAPI Key", placeholder: "sk-..." },
                { label: "PDL API Key", placeholder: "..." },
                { label: "Resend API Key", placeholder: "re_..." },
              ].map(({ label, placeholder }) => (
                <div key={label}>
                  <label className="block text-xs font-medium text-muted mb-1">{label}</label>
                  <input
                    type="password"
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-border rounded-xl p-5">
            <h2 className="font-semibold mb-4">邮件设置</h2>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">发件人邮箱</label>
              <input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="your@company.com"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
              saved ? "bg-success text-white" : "bg-primary text-white hover:bg-primary-600"
            }`}
          >
            {saved ? "✓ 已保存" : "保存设置"}
          </button>

          <div className="bg-gray-50 border border-border rounded-xl p-4">
            <p className="text-xs text-muted">
              <strong>注意：</strong>API密钥应配置在服务器端 .env 文件中，不会在前端暴露。
              此页面的设置功能仅作为界面展示。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
