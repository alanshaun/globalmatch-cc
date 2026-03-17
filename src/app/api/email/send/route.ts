/**
 * POST /api/email/send - Send outreach email with tracking pixel
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Resend } from "resend";
import { v4 as uuidv4 } from "uuid";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { buyerMatchId, subject, body: emailBody, subjectVariant, userId } = body;

    const trackingId = uuidv4();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const trackingPixel = `<img src="${baseUrl}/api/track/${trackingId}" width="1" height="1" style="display:none" />`;

    const htmlBody = emailBody.replace(/\n/g, "<br>") + trackingPixel;

    const buyer = await prisma.buyerMatch.findUnique({
      where: { id: buyerMatchId },
    }).catch(() => null);

    const toEmail = buyer?.contacts
      ? (buyer.contacts as { email: string }[])[0]?.email
      : null;

    if (!toEmail) {
      return NextResponse.json({ error: "No email address found" }, { status: 400 });
    }

    const { data, error } = await resend.emails.send({
      from: "GlobalMatch <outreach@globalmatch.ai>",
      to: [toEmail],
      subject,
      html: htmlBody,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Save to DB
    const record = await prisma.emailOutreach.create({
      data: {
        userId: userId || "demo-user",
        buyerMatchId,
        subject,
        subjectVariant: subjectVariant || "A",
        body: emailBody,
        status: "sent",
        sentAt: new Date(),
        trackingPixelId: trackingId,
      },
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      emailId: data?.id,
      trackingId,
      recordId: record?.id,
    });
  } catch (err) {
    console.error("[/api/email/send]", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
