-- CreateTable
CREATE TABLE "auction_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "columnMap" JSONB NOT NULL,
    "isPreset" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auction_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_source_emails" (
    "id" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "auction_source_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_lists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scoredAt" TIMESTAMP(3),

    CONSTRAINT "run_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_list_vehicles" (
    "id" TEXT NOT NULL,
    "runListId" TEXT NOT NULL,
    "vin" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "trim" TEXT,
    "odometer" INTEGER,
    "crGrade" DECIMAL(3,1),
    "mmr" INTEGER,
    "demandScore" INTEGER,
    "demandRank" INTEGER,
    "rawData" JSONB NOT NULL,

    CONSTRAINT "run_list_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_cache" (
    "id" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "listingCount" INTEGER NOT NULL,
    "demandScore" INTEGER NOT NULL,
    "lastRefreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filter_presets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filter_presets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auction_sources_name_key" ON "auction_sources"("name");

-- CreateIndex
CREATE UNIQUE INDEX "auction_source_emails_emailAddress_key" ON "auction_source_emails"("emailAddress");

-- CreateIndex
CREATE UNIQUE INDEX "market_cache_make_model_year_key" ON "market_cache"("make", "model", "year");

-- AddForeignKey
ALTER TABLE "auction_source_emails" ADD CONSTRAINT "auction_source_emails_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "auction_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_lists" ADD CONSTRAINT "run_lists_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "auction_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_list_vehicles" ADD CONSTRAINT "run_list_vehicles_runListId_fkey" FOREIGN KEY ("runListId") REFERENCES "run_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
