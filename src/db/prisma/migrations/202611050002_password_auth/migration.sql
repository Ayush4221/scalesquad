ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT, ADD COLUMN "passwordChangedAt" TIMESTAMP(3), ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "lastFailedLoginAt" TIMESTAMP(3), ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- A collision fails this migration for operator review; never merge identities silently.
UPDATE "User" SET "email" = lower(normalize(btrim("email"), NFKC)) WHERE "email" IS NOT NULL;
ALTER TABLE "User" ADD CONSTRAINT "User_email_normalized" CHECK ("email" IS NULL OR "email" = lower(normalize(btrim("email"), NFKC)));
CREATE TYPE "EmailTokenPurpose" AS ENUM ('VERIFY_EMAIL','RESET_PASSWORD');
CREATE TYPE "AuthEventType" AS ENUM ('REGISTER','VERIFY','LOGIN_OK','LOGIN_FAIL','LOGOUT','LOGOUT_ALL','RESET_REQUEST','RESET_OK','PASSWORD_CHANGE','THROTTLED');
CREATE TABLE "EmailToken" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "purpose" "EmailTokenPurpose" NOT NULL, "tokenHash" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EmailToken_tokenHash_key" ON "EmailToken"("tokenHash");
CREATE INDEX "EmailToken_userId_purpose_idx" ON "EmailToken"("userId","purpose");
CREATE TABLE "AuthEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT, "type" "AuthEventType" NOT NULL, "ipPrefix" TEXT NOT NULL, "userAgent" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "AuthEvent_userId_createdAt_idx" ON "AuthEvent"("userId","createdAt");
CREATE INDEX "Match_hostUserId_createdAt_idx" ON "Match"("hostUserId","createdAt");
CREATE INDEX "Match_phase_simulationLocked_deadlineAt_idx" ON "Match"("phase","simulationLocked","deadlineAt");
CREATE INDEX "MatchMember_matchId_lastSeenAt_idx" ON "MatchMember"("matchId","lastSeenAt");
