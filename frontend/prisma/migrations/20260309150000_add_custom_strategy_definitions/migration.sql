-- CreateTable
CREATE TABLE "CustomStrategyDefinition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "definitionVersion" INTEGER NOT NULL DEFAULT 1,
    "definition" JSONB NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomStrategyDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomStrategyDefinition_userId_idx" ON "CustomStrategyDefinition"("userId");

-- AddForeignKey
ALTER TABLE "CustomStrategyDefinition" ADD CONSTRAINT "CustomStrategyDefinition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
