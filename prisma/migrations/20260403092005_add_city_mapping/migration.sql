-- CreateTable
CREATE TABLE "CityMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "shopifyCity" TEXT NOT NULL,
    "qpCityId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "CityMapping_shop_idx" ON "CityMapping"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "CityMapping_shop_shopifyCity_key" ON "CityMapping"("shop", "shopifyCity");
