/*
  Warnings:

  - You are about to drop the column `currentPeriodEnd` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "currentPeriodEnd",
ADD COLUMN     "subscriptionPlan" TEXT,
ALTER COLUMN "subscriptionStatus" DROP DEFAULT;
