-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "pin" TEXT NOT NULL,
    "isActivated" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'PLAYER',
    "bio" TEXT,
    "country" TEXT DEFAULT 'India',
    "state" TEXT DEFAULT 'Tamil Nadu',
    "city" TEXT DEFAULT 'Chennai',
    "address" TEXT,
    "pincode" TEXT,
    "whatsApp" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "average" DOUBLE PRECISION DEFAULT 0.0,
    "target" INTEGER DEFAULT 0,
    "rating" INTEGER NOT NULL DEFAULT 1200,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "queenStrikes" INTEGER NOT NULL DEFAULT 0,
    "boardsWon" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Edition" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "theme" TEXT,
    "themeDescription" TEXT,
    "themeHint" TEXT,
    "posterUrl" TEXT,
    "bannerImage" TEXT,
    "registrationStartDate" TIMESTAMP(3),
    "registrationEndDate" TIMESTAMP(3),
    "tournamentStartDate" TIMESTAMP(3),
    "tournamentEndDate" TIMESTAMP(3),
    "totalDays" INTEGER NOT NULL DEFAULT 15,
    "dayDates" TEXT,
    "format" TEXT NOT NULL DEFAULT 'SINGLE_ELIMINATION',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "slot" TEXT,
    "enrollmentFee" DOUBLE PRECISION DEFAULT 0,
    "paymentQrUrl" TEXT,
    "paymentUpiLink" TEXT,
    "paymentPhoneNumber" TEXT,
    "intlPaymentQrUrl" TEXT,
    "intlPaymentUpiLink" TEXT,
    "intlPaymentPhone" TEXT,
    "publishedAt" TIMESTAMP(3),
    "prizePool" TEXT NOT NULL DEFAULT 'Γé╣0 INR',
    "maxTeams" INTEGER NOT NULL DEFAULT 16,
    "rules" TEXT,
    "organizerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Edition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditionParticipant" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT,
    "category" TEXT,
    "startingRank" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "result" TEXT,
    "gradeAverage" DOUBLE PRECISION,
    "gradeAverageLocked" BOOLEAN NOT NULL DEFAULT false,
    "isSpoc" BOOLEAN NOT NULL DEFAULT false,
    "enrolledAt" TIMESTAMP(3),
    "paymentStatus" TEXT,
    "paymentAmount" DOUBLE PRECISION,
    "paymentTransactionId" TEXT,
    "paymentMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "logo" TEXT,
    "description" TEXT,
    "captainId" TEXT,
    "teamType" TEXT NOT NULL DEFAULT 'MAIN',
    "savedLineups" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpocTeamMember" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpocTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardPattern" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'MEDIUM',
    "objective" TEXT NOT NULL,
    "validCoins" TEXT NOT NULL,
    "invalidCoins" TEXT NOT NULL,
    "basePoints" INTEGER NOT NULL DEFAULT 0,
    "queenBonus" INTEGER NOT NULL DEFAULT 0,
    "penaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "instructionalMedia" TEXT,
    "diagramUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditionBoardPattern" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "matchFormat" TEXT NOT NULL,

    CONSTRAINT "EditionBoardPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "matchNumber" INTEGER NOT NULL DEFAULT 1,
    "stage" TEXT NOT NULL DEFAULT 'LEAGUE',
    "team1Id" TEXT,
    "team2Id" TEXT,
    "score1" INTEGER NOT NULL DEFAULT 0,
    "score2" INTEGER NOT NULL DEFAULT 0,
    "queenStrikes1" INTEGER NOT NULL DEFAULT 0,
    "queenStrikes2" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "winnerId" TEXT,
    "scheduledTime" TIMESTAMP(3),
    "tableNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchLineup" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "overrideNotes" TEXT,

    CONSTRAINT "MatchLineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchLineupSlot" (
    "id" TEXT NOT NULL,
    "lineupId" TEXT NOT NULL,
    "formatType" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "patternName" TEXT NOT NULL,

    CONSTRAINT "MatchLineupSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchLineupSlotPlayer" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "MatchLineupSlotPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreReport" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "team1Score" INTEGER NOT NULL,
    "team2Score" INTEGER NOT NULL,
    "queenStrikes1" INTEGER NOT NULL DEFAULT 0,
    "queenStrikes2" INTEGER NOT NULL DEFAULT 0,
    "proofNotes" TEXT,
    "proofUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerRankingSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "globalRank" INTEGER NOT NULL,
    "countryRank" INTEGER,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerRankingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueStanding" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "played" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "scoreDiff" INTEGER NOT NULL DEFAULT 0,
    "queenStrikes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueStanding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HallOfFame" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "achievement" TEXT NOT NULL,
    "inductionYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HallOfFame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerCategoryHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "oldCategory" TEXT,
    "newCategory" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerCategoryHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorCount" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitorCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveStream" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "matchId" TEXT,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT,
    "dayNumber" INTEGER,
    "youtubeBroadcastId" TEXT,
    "youtubeStreamId" TEXT,
    "youtubeVideoId" TEXT,
    "rtmpIngestionUrl" TEXT,
    "streamKey" TEXT,
    "youtubeUrl" TEXT,
    "youtubeEmbedUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "failureReason" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "streamStartedAt" TIMESTAMP(3),
    "streamEndedAt" TIMESTAMP(3),
    "recordedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveStream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerDayScore" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "slams" INTEGER NOT NULL DEFAULT 0,
    "boards" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "enteredByUserId" TEXT,

    CONSTRAINT "PlayerDayScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerAverageLog" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "average" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT NOT NULL,

    CONSTRAINT "PlayerAverageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerTargetLog" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "effectiveFrom" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT NOT NULL,

    CONSTRAINT "PlayerTargetLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "UserPushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPushToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Edition_number_key" ON "Edition"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Edition_slug_key" ON "Edition"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Edition_slot_key" ON "Edition"("slot");

-- CreateIndex
CREATE UNIQUE INDEX "EditionParticipant_editionId_userId_key" ON "EditionParticipant"("editionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_editionId_name_key" ON "Team"("editionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_editionId_tag_key" ON "Team"("editionId", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "SpocTeamMember_editionId_userId_key" ON "SpocTeamMember"("editionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SpocTeamMember_teamId_userId_key" ON "SpocTeamMember"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BoardPattern_name_key" ON "BoardPattern"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EditionBoardPattern_editionId_sequence_key" ON "EditionBoardPattern"("editionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "MatchLineup_matchId_teamId_key" ON "MatchLineup"("matchId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchLineupSlotPlayer_slotId_userId_key" ON "MatchLineupSlotPlayer"("slotId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerRankingSnapshot_userId_editionId_key" ON "PlayerRankingSnapshot"("userId", "editionId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueStanding_editionId_teamId_key" ON "LeagueStanding"("editionId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveStream_youtubeBroadcastId_key" ON "LiveStream"("youtubeBroadcastId");

-- CreateIndex
CREATE INDEX "LiveStream_editionId_idx" ON "LiveStream"("editionId");

-- CreateIndex
CREATE INDEX "LiveStream_matchId_idx" ON "LiveStream"("matchId");

-- CreateIndex
CREATE INDEX "LiveStream_playerId_idx" ON "LiveStream"("playerId");

-- CreateIndex
CREATE INDEX "LiveStream_dayNumber_idx" ON "LiveStream"("dayNumber");

-- CreateIndex
CREATE INDEX "LiveStream_status_idx" ON "LiveStream"("status");

-- CreateIndex
CREATE INDEX "PlayerDayScore_editionId_dayNumber_idx" ON "PlayerDayScore"("editionId", "dayNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerDayScore_editionId_userId_dayNumber_key" ON "PlayerDayScore"("editionId", "userId", "dayNumber");

-- CreateIndex
CREATE INDEX "PlayerAverageLog_editionId_userId_effectiveFrom_idx" ON "PlayerAverageLog"("editionId", "userId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "PlayerTargetLog_editionId_userId_effectiveFrom_idx" ON "PlayerTargetLog"("editionId", "userId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "UserPushToken_token_key" ON "UserPushToken"("token");

-- CreateIndex
CREATE INDEX "UserPushToken_userId_idx" ON "UserPushToken"("userId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edition" ADD CONSTRAINT "Edition_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditionParticipant" ADD CONSTRAINT "EditionParticipant_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditionParticipant" ADD CONSTRAINT "EditionParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditionParticipant" ADD CONSTRAINT "EditionParticipant_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_captainId_fkey" FOREIGN KEY ("captainId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpocTeamMember" ADD CONSTRAINT "SpocTeamMember_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpocTeamMember" ADD CONSTRAINT "SpocTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpocTeamMember" ADD CONSTRAINT "SpocTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditionBoardPattern" ADD CONSTRAINT "EditionBoardPattern_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditionBoardPattern" ADD CONSTRAINT "EditionBoardPattern_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "BoardPattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_team1Id_fkey" FOREIGN KEY ("team1Id") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_team2Id_fkey" FOREIGN KEY ("team2Id") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLineup" ADD CONSTRAINT "MatchLineup_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLineup" ADD CONSTRAINT "MatchLineup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLineupSlot" ADD CONSTRAINT "MatchLineupSlot_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "MatchLineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLineupSlotPlayer" ADD CONSTRAINT "MatchLineupSlotPlayer_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "MatchLineupSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLineupSlotPlayer" ADD CONSTRAINT "MatchLineupSlotPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreReport" ADD CONSTRAINT "ScoreReport_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreReport" ADD CONSTRAINT "ScoreReport_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerRankingSnapshot" ADD CONSTRAINT "PlayerRankingSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerRankingSnapshot" ADD CONSTRAINT "PlayerRankingSnapshot_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueStanding" ADD CONSTRAINT "LeagueStanding_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueStanding" ADD CONSTRAINT "LeagueStanding_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallOfFame" ADD CONSTRAINT "HallOfFame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerCategoryHistory" ADD CONSTRAINT "PlayerCategoryHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerCategoryHistory" ADD CONSTRAINT "PlayerCategoryHistory_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveStream" ADD CONSTRAINT "LiveStream_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveStream" ADD CONSTRAINT "LiveStream_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveStream" ADD CONSTRAINT "LiveStream_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveStream" ADD CONSTRAINT "LiveStream_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDayScore" ADD CONSTRAINT "PlayerDayScore_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDayScore" ADD CONSTRAINT "PlayerDayScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAverageLog" ADD CONSTRAINT "PlayerAverageLog_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAverageLog" ADD CONSTRAINT "PlayerAverageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerTargetLog" ADD CONSTRAINT "PlayerTargetLog_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerTargetLog" ADD CONSTRAINT "PlayerTargetLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPushToken" ADD CONSTRAINT "UserPushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

