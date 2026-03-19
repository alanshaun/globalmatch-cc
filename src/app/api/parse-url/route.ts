/**
 * POST /api/parse-url - Scrape a URL and extract product info
 */

import { NextRequest, NextResponse } from "next/server";
import { analyzeProduct } from "@/services/productAnalyzer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Fetch page content with timeout
    let extractedText = "";
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(parsedUrl.toString(), {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      clearTimeout(timeout);

      const html = await res.text();

      // Strip HTML tags and extract readable text
      extractedText = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 8000);
    } catch (fetchErr) {
      return NextResponse.json(
        { error: "Cannot access URL, please check the link" },
        { status: 422 }
      );
    }

    if (!extractedText || extractedText.length < 50) {
      return NextResponse.json(
        { error: "Page content too short or empty" },
        { status: 422 }
      );
    }

    // Prepend URL as context
    const input = `Source URL: ${parsedUrl.toString()}\n\n${extractedText}`;
    const profile = await analyzeProduct(input);

    return NextResponse.json({
      profile,
      extractedText: extractedText.slice(0, 500),
    });
  } catch (err) {
    console.error("[/api/parse-url]", err);
    return NextResponse.json({ error: "URL parsing failed" }, { status: 500 });
  }
}
