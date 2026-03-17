/**
 * GET /api/search/stream?sessionId=xxx&userId=xxx
 * SSE endpoint - streams buyer results as they're found
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { runBuyerSearch } from "@/services/searchOrchestrator";
import type { SearchProgress } from "@/services/searchOrchestrator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  const userId = searchParams.get("userId") || "demo-user";

  if (!sessionId) {
    return new Response("Missing sessionId", { status: 400 });
  }

  // Set up SSE headers
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: SearchProgress) {
        if (closed) return;
        try {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          closed = true;
        }
      }

      // Load session and profile
      let session;
      let profile;

      try {
        session = await prisma.searchSession.findUnique({
          where: { id: sessionId },
          include: { sellerProfile: true },
        });

        if (!session) {
          send({ type: "error", message: "Session not found" });
          controller.close();
          return;
        }

        profile = {
          productName: session.sellerProfile.productName,
          productDescription: session.sellerProfile.productDescription,
          hsCode: session.sellerProfile.hsCode || "",
          category: session.sellerProfile.category || "General",
          targetBuyerTypes: ["importer", "distributor"],
          pricePositioning: (session.sellerProfile.pricePositioning as "high" | "mid" | "low") || "mid",
          certifications: (session.sellerProfile.certifications as string[]) || [],
          coreAdvantages: (session.sellerProfile.coreAdvantages as string[]) || [],
          searchKeywords: (session.sellerProfile.searchKeywords as string[]) || [
            session.sellerProfile.productName,
          ],
        };
      } catch {
        // DB not available - use session data from params or fallback
        const profileName = searchParams.get("productName") || "Product";
        profile = {
          productName: profileName,
          productDescription: searchParams.get("description") || "",
          hsCode: "",
          category: "General",
          targetBuyerTypes: ["importer", "distributor"],
          pricePositioning: "mid" as const,
          certifications: [],
          coreAdvantages: [],
          searchKeywords: [profileName],
        };
      }

      // Update session status
      try {
        await prisma.searchSession.update({
          where: { id: sessionId },
          data: { status: "running" },
        });
      } catch {
        // Continue without DB
      }

      const targetCountries = session?.targetCountries || ["美国"];
      const targetCount = session?.targetCount || 20;

      // Run search
      await runBuyerSearch(
        sessionId,
        userId,
        profile,
        targetCountries,
        targetCount,
        send
      ).catch((err) => {
        console.error("[SSE] Search error:", err);
        send({
          type: "error",
          message: "搜索过程中遇到问题，已返回最优结果",
        });
        send({ type: "completed", foundCount: 0, isFallback: true });
      });

      controller.close();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
