-- CreateTable
CREATE TABLE "QPExpressConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "token" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OrderMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "shopifyOrderNumber" TEXT NOT NULL,
    "shopifyFulfillmentId" TEXT,
    "qpExpressSerial" TEXT,
    "qpStatus" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'pending',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "QPExpressConfig_shop_key" ON "QPExpressConfig"("shop");

-- CreateIndex
CREATE INDEX "OrderMapping_shop_idx" ON "OrderMapping"("shop");

-- CreateIndex
CREATE INDEX "OrderMapping_syncStatus_idx" ON "OrderMapping"("syncStatus");

-- CreateIndex
CREATE INDEX "OrderMapping_qpExpressSerial_idx" ON "OrderMapping"("qpExpressSerial");

-- CreateIndex
CREATE UNIQUE INDEX "OrderMapping_shop_shopifyOrderId_key" ON "OrderMapping"("shop", "shopifyOrderId");
