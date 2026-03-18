-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productDescription" TEXT NOT NULL,
    "hsCode" TEXT,
    "category" TEXT,
    "pricePositioning" TEXT,
    "certifications" JSONB NOT NULL DEFAULT '[]',
    "coreAdvantages" JSONB NOT NULL DEFAULT '[]',
    "rawInputType" TEXT NOT NULL,
    "rawInputContent" TEXT,
    "searchKeywords" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sellerProfileId" TEXT NOT NULL,
    "targetCountries" TEXT[],
    "targetCount" INTEGER NOT NULL DEFAULT 20,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "intentScore" INTEGER NOT NULL DEFAULT 0,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "fallbackReason" TEXT,
    "auditLog" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SearchSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerMatch" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "website" TEXT,
    "domain" TEXT NOT NULL,
    "country" TEXT,
    "industry" TEXT,
    "matchScore" INTEGER NOT NULL DEFAULT 0,
    "fitScore" INTEGER NOT NULL DEFAULT 0,
    "intentScore" INTEGER NOT NULL DEFAULT 0,
    "reachabilityScore" INTEGER NOT NULL DEFAULT 0,
    "confidenceScore" INTEGER NOT NULL DEFAULT 0,
    "matchReason" TEXT,
    "buyerBusiness" TEXT,
    "whyTheyNeedUs" TEXT,
    "supplierWeakness" TEXT,
    "intentSignals" JSONB NOT NULL DEFAULT '[]',
    "contacts" JSONB NOT NULL DEFAULT '[]',
    "emailDraft" JSONB NOT NULL DEFAULT '{}',
    "dataSource" TEXT NOT NULL DEFAULT 'serpapi',
    "fromCache" BOOLEAN NOT NULL DEFAULT false,
    "shipmentCount" INTEGER NOT NULL DEFAULT 0,
    "lastShipment" TIMESTAMP(3),
    "isFavorited" BOOLEAN NOT NULL DEFAULT false,
    "competitorData" JSONB NOT NULL DEFAULT '{}',
    "socialDynamics" JSONB NOT NULL DEFAULT '{}',
    "reachabilityStatus" JSONB NOT NULL DEFAULT '{}',
    "outreachHook" TEXT,
    "funnelStage" TEXT NOT NULL DEFAULT 'discovered',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyerMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSeenCompany" (
    "userId" TEXT NOT NULL,
    "companyDomain" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSeenCompany_pkey" PRIMARY KEY ("userId","companyDomain")
);

-- CreateTable
CREATE TABLE "EmailOutreach" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "buyerMatchId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "subjectVariant" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "trackingPixelId" TEXT NOT NULL,
    "firstSentenceType" TEXT,

    CONSTRAINT "EmailOutreach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuccessPattern" (
    "id" TEXT NOT NULL,
    "sellerCategory" TEXT,
    "buyerType" TEXT,
    "buyerCountry" TEXT,
    "buyerSize" TEXT,
    "intentSignalsPresent" BOOLEAN NOT NULL DEFAULT false,
    "supplierWeaknessPresent" BOOLEAN NOT NULL DEFAULT false,
    "firstSentenceType" TEXT,
    "timingType" TEXT,
    "resultedInReply" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuccessPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchCache" (
    "cacheKey" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchCache_pkey" PRIMARY KEY ("cacheKey")
);

-- CreateTable
CREATE TABLE "InteractionTimeline" (
    "id" TEXT NOT NULL,
    "buyerMatchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InteractionTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "EmailOutreach_status_idx" ON "EmailOutreach"("status");

-- CreateIndex
CREATE INDEX "EmailOutreach_sentAt_idx" ON "EmailOutreach"("sentAt");

-- CreateIndex
CREATE INDEX "SearchCache_expiresAt_idx" ON "SearchCache"("expiresAt");

-- CreateIndex
CREATE INDEX "InteractionTimeline_buyerMatchId_idx" ON "InteractionTimeline"("buyerMatchId");

-- CreateIndex
CREATE INDEX "InteractionTimeline_userId_idx" ON "InteractionTimeline"("userId");

-- CreateIndex
CREATE INDEX "InteractionTimeline_occurredAt_idx" ON "InteractionTimeline"("occurredAt");

-- AddForeignKey
ALTER TABLE "SellerProfile" ADD CONSTRAINT "SellerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchSession" ADD CONSTRAINT "SearchSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchSession" ADD CONSTRAINT "SearchSession_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerMatch" ADD CONSTRAINT "BuyerMatch_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SearchSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerMatch" ADD CONSTRAINT "BuyerMatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSeenCompany" ADD CONSTRAINT "UserSeenCompany_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailOutreach" ADD CONSTRAINT "EmailOutreach_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailOutreach" ADD CONSTRAINT "EmailOutreach_buyerMatchId_fkey" FOREIGN KEY ("buyerMatchId") REFERENCES "BuyerMatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionTimeline" ADD CONSTRAINT "InteractionTimeline_buyerMatchId_fkey" FOREIGN KEY ("buyerMatchId") REFERENCES "BuyerMatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionTimeline" ADD CONSTRAINT "InteractionTimeline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

