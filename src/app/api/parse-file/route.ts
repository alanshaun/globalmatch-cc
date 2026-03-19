/**
 * POST /api/parse-file - Parse uploaded file and extract product info
 */

import { NextRequest, NextResponse } from "next/server";
import { analyzeProduct } from "@/services/productAnalyzer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const mimeType = file.type;
    let extractedText = "";

    if (mimeType === "application/pdf") {
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(buffer);
      extractedText = data.text.slice(0, 8000);
    } else if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/msword"
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value.slice(0, 8000);
    } else if (mimeType.startsWith("image/")) {
      // Use Kimi vision for images
      const base64 = buffer.toString("base64");
      const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.KIMI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "moonshot-v1-32k",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: `data:${mimeType};base64,${base64}` },
                },
                {
                  type: "text",
                  text: "请描述这个产品图片中的产品信息，包括产品名称、功能、规格、特点等。",
                },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (res.ok) {
        const data = await res.json();
        extractedText = data.choices[0]?.message?.content || "";
      }
    } else {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 }
      );
    }

    if (!extractedText) {
      return NextResponse.json(
        { error: "Could not extract text from file" },
        { status: 422 }
      );
    }

    // Analyze to get product profile
    const profile = await analyzeProduct(extractedText);

    return NextResponse.json({
      profile,
      extractedText: extractedText.slice(0, 500),
    });
  } catch (err) {
    console.error("[/api/parse-file]", err);
    return NextResponse.json(
      { error: "File parsing failed" },
      { status: 500 }
    );
  }
}
