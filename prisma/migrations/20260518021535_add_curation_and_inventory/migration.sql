-- AlterTable
ALTER TABLE "run_list_vehicles" ADD COLUMN     "accidents" INTEGER,
ADD COLUMN     "carfaxValue" INTEGER,
ADD COLUMN     "isExcluded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "owners" INTEGER,
ADD COLUMN     "ownershipType" TEXT;

-- CreateTable
CREATE TABLE "dealer_inventory" (
    "id" TEXT NOT NULL,
    "vin" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "trim" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dealer_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dealer_inventory_vin_key" ON "dealer_inventory"("vin");
