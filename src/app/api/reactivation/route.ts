/**
 * GET /api/reactivation - Get silent buyers
 * POST /api/reactivation/strategy - Generate reactivation strategy
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { llmParseJSON } from "@/lib/llmClient";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || "demo-user";
  const silentDays = parseInt(searchParams.get("silentDays") || "7");

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - silentDays);

    const silentEmails = await prisma.emailOutreach.findMany({
      where: {
        userId,
        status: { in: ["sent", "opened"] },
        sentAt: { lt: cutoff },
        repliedAt: null,
      },
      include: { buyerMatch: true },
      orderBy: { sentAt: "asc" },
    });

    const buyers = silentEmails.map((e) => ({
      id: e.id,
      companyName: e.buyerMatch.companyName,
      domain: e.buyerMatch.domain,
      sentAt: e.sentAt,
      isOpened: e.status === "opened",
      openCount: e.openCount,
      silentDays: Math.floor((Date.now() - (e.sentAt?.getTime() || 0)) / 86400000),
      subject: e.subject,
      body: e.body,
    }));

    return NextResponse.json({ buyers });
  } catch {
    return NextResponse.json({ buyers: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { emailId, companyName, isOpened, silentDays, originalSubject, originalBody } = await req.json();

    const scenario = isOpened
      ? "opened but not replied"
      : silentDays > 30
        ? "silent for 30+ days"
        : "not opened";

    const result = await llmParseJSON<{
      strategy: string;
      followUpSubject: string;
      followUpBody: string;
      linkedinSuggestion: string;
      bestSendTime: string;
      sendDayOfWeek: string;
    }>(
      `You are a B2B sales coach. Create a reactivation strategy for a silent buyer.

Company: ${companyName}
Situation: Email was ${scenario}
Silent for: ${silentDays} days
Original subject: "${originalSubject}"
Original email excerpt: "${originalBody?.slice(0, 200)}"

Return ONLY this JSON:
{
  "strategy": "recommended approach (2-3 sentences)",
  "followUpSubject": "new subject line (completely different angle from original)",
  "followUpBody": "follow-up email body (100-130 words, different angle from original, no apologizing for following up)",
  "linkedinSuggestion": "specific LinkedIn engagement suggestion (which type of post to comment on, what to say)",
  "bestSendTime": "best time to send (e.g., Tuesday 10am buyer timezone)",
  "sendDayOfWeek": "Tuesday"
}`,
      "You are an expert B2B sales follow-up strategist.",
      {
        strategy: "Try a completely different value proposition angle",
        followUpSubject: `Quick question about ${companyName}'s sourcing`,
        followUpBody: "Following up with a different perspective on how we might help...",
        linkedinSuggestion: "Comment on their recent company post with a relevant industry insight",
        bestSendTime: "Tuesday 10am",
        sendDayOfWeek: "Tuesday",
      }
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/reactivation]", err);
    return NextResponse.json({ error: "Strategy generation failed" }, { status: 500 });
  }
}
