-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QPExpressConfig" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "token" TEXT,
    "companyName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QPExpressConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CityMapping" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopifyCity" TEXT NOT NULL,
    "qpCityId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CityMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderMapping" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "shopifyOrderNumber" TEXT NOT NULL,
    "shopifyFulfillmentId" TEXT,
    "qpExpressSerial" TEXT,
    "qpStatus" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'pending',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QPExpressConfig_shop_key" ON "QPExpressConfig"("shop");

-- CreateIndex
CREATE INDEX "CityMapping_shop_idx" ON "CityMapping"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "CityMapping_shop_shopifyCity_key" ON "CityMapping"("shop", "shopifyCity");

-- CreateIndex
CREATE INDEX "OrderMapping_shop_idx" ON "OrderMapping"("shop");

-- CreateIndex
CREATE INDEX "OrderMapping_syncStatus_idx" ON "OrderMapping"("syncStatus");

-- CreateIndex
CREATE INDEX "OrderMapping_qpExpressSerial_idx" ON "OrderMapping"("qpExpressSerial");

-- CreateIndex
CREATE UNIQUE INDEX "OrderMapping_shop_shopifyOrderId_key" ON "OrderMapping"("shop", "shopifyOrderId");
