/**
 * LLM Client - 3-tier fallback: Kimi → Gemini → Rules Engine
 * Never fails, always returns structured data
 */

const KIMI_BASE = "https://api.moonshot.cn/v1";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export interface LLMResponse {
  content: string;
  provider: "kimi" | "gemini" | "rules";
  model: string;
}

async function callKimi(
  prompt: string,
  systemPrompt?: string,
  temperature = 0.3
): Promise<string> {
  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const res = await fetch(`${KIMI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.KIMI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "moonshot-v1-32k",
      messages,
      temperature,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (res.status === 429) throw new Error("KIMI_RATE_LIMITED");
  if (!res.ok) throw new Error(`Kimi error: ${res.status}`);

  const data = await res.json();
  return data.choices[0]?.message?.content || "";
}

async function callGemini(
  prompt: string,
  systemPrompt?: string,
  temperature = 0.3
): Promise<string> {
  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

  const res = await fetch(
    `${GEMINI_BASE}/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { temperature, maxOutputTokens: 4096 },
      }),
      signal: AbortSignal.timeout(30000),
    }
  );

  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

function extractJSON(text: string): string {
  // Try to extract JSON from markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  // Try to find raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];

  return text;
}

export function parseJSON<T>(text: string, fallback: T): T {
  try {
    const cleaned = extractJSON(text);
    return JSON.parse(cleaned) as T;
  } catch {
    try {
      // Second attempt: fix common JSON issues
      const fixed = text
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]")
        .replace(/'/g, '"');
      const cleaned = extractJSON(fixed);
      return JSON.parse(cleaned) as T;
    } catch {
      return fallback;
    }
  }
}

// Fallback structures for different use cases
const FALLBACKS = {
  buyerAnalysis: {
    buyerBusiness: "Business information unavailable",
    buyerProductKeywords: [],
    whyTheyNeedUs: "AI analysis unavailable",
    currentSupplierWeakness: "Analysis unavailable",
    fitScore: 30,
    fitReason: "AI unavailable",
    intentScore: 20,
    intentReason: "AI unavailable",
    reachabilityScore: 40,
    reachabilityReason: "Contact found",
    confidenceScore: 30,
    confidenceReason: "Limited data",
    bestContactTiming: "Standard business hours",
    redFlags: [],
    matchScore: 25,
    generatedBy: "rule_engine",
  },
  productProfile: {
    productName: "",
    productDescription: "",
    hsCode: "",
    category: "General",
    targetBuyerTypes: ["importer", "distributor"],
    pricePositioning: "mid",
    certifications: [],
    coreAdvantages: [],
    searchKeywords: [],
    generatedBy: "rule_engine",
  },
  emailDraft: {
    subject_a: "Exploring Partnership Opportunity",
    subject_b: "Quality Products for Your Business",
    body: "Dear [Contact],\n\nI wanted to introduce our company and explore potential collaboration opportunities.\n\nBest regards,\n[Your Name]",
    generatedBy: "rule_engine",
  },
};

export type FallbackType = keyof typeof FALLBACKS;

export async function llmCall(
  prompt: string,
  systemPrompt?: string,
  options: {
    temperature?: number;
    fallbackType?: FallbackType;
    fallbackData?: Record<string, unknown>;
  } = {}
): Promise<LLMResponse> {
  const { temperature = 0.3, fallbackType, fallbackData } = options;

  // Try Kimi first
  try {
    const content = await callKimi(prompt, systemPrompt, temperature);
    return { content, provider: "kimi", model: "moonshot-v1-32k" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "KIMI_RATE_LIMITED") {
      console.warn("[LLM] Kimi rate limited, switching to Gemini");
    } else {
      console.warn("[LLM] Kimi failed:", msg);
    }
  }

  // Try Gemini
  try {
    const content = await callGemini(prompt, systemPrompt, temperature);
    return { content, provider: "gemini", model: "gemini-1.5-flash" };
  } catch (err) {
    console.warn("[LLM] Gemini failed:", err instanceof Error ? err.message : err);
  }

  // Rules engine fallback
  console.warn("[LLM] All LLMs failed, using rule engine fallback");
  const fallback = fallbackData ||
    (fallbackType ? FALLBACKS[fallbackType] : { result: "unavailable" });

  return {
    content: JSON.stringify(fallback),
    provider: "rules",
    model: "rule_engine",
  };
}

export async function llmParseJSON<T>(
  prompt: string,
  systemPrompt: string,
  fallback: T,
  options: {
    temperature?: number;
    fallbackType?: FallbackType;
  } = {}
): Promise<T & { generatedBy?: string }> {
  const response = await llmCall(prompt, systemPrompt, options);
  const parsed = parseJSON<T>(response.content, fallback);
  return { ...parsed, generatedBy: response.provider };
}
