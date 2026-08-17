export type UserRole = 'ORGANIZER' | 'CAPTAIN' | 'PLAYER';

export type TournamentFormat = 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN' | 'SWISS' | 'CBOT_HYBRID_PLAYOFFS' | 'MULTI_STAGE';
export type TournamentStatus = 'DRAFT' | 'REGISTRATION_OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'DISPUTED';
export type RegistrationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type PlayerCategory = 'CATEGORY_A' | 'CATEGORY_B' | 'CATEGORY_C' | 'CATEGORY_D';
export type MatchStage =
  | 'ROUND_ROBIN'
  | 'LEAGUE'
  | 'LEAGUE_A'
  | 'LEAGUE_B'
  | 'LEAGUE_C'
  | 'LEAGUE_D'
  | 'LEAGUE2_A'
  | 'LEAGUE2_B'
  | 'LEAGUE2_C'
  | 'LEAGUE2_D'
  | 'LEAGUE3_A'
  | 'LEAGUE3_B'
  | 'LEAGUE3_C'
  | 'LEAGUE3_D'
  | 'QUALIFIER_1'
  | 'QUALIFIER_2'
  | 'QUALIFIER_3'
  | 'QUALIFIER_4'
  | 'GRAND_FINAL'
  | 'THIRD_PLACE'
  | 'FIFTH_PLACE'
  | 'SEVENTH_PLACE';
export type StageKind = 'ROUND_ROBIN' | 'LEAGUE' | 'QUALIFIER' | 'FINALS';
export type StageSeeding = 'RR_STANDINGS_SNAKE' | 'RR_STANDINGS_SPLIT' | 'MANUAL';
export type QualifierPairing = 'CROSS' | 'RANKED';
export type ScheduleMode = 'DIVIDED' | 'SEQUENCE';

export interface LeagueGroupConfig {
  name: string;
  key?: string;
  teamIds: string[];
}

export interface TournamentStage {
  id: string;
  order: number;
  kind: StageKind;
  name: string;
  teamCount?: number;
  groupCount?: number;
  teamsPerGroup?: number;
  qualifyPerGroup?: number;
  seeding?: StageSeeding;
  groups?: LeagueGroupConfig[];
  pairing?: QualifierPairing;
  includeThirdPlace?: boolean;
  startDay?: number;
  durationDays?: number;
  leagueIndex?: number;
  matchPairings?: Array<{
    stage: string;
    label: string;
    team1Id: string;
    team2Id: string;
    team1Name?: string;
    team2Name?: string;
    round?: number;
    dayNumber?: number;
    scheduledTime?: string;
    tableNumber?: number;
  }>;
}

export interface TournamentStageConfig {
  stages: TournamentStage[];
  scheduleMode?: ScheduleMode;
}
export type LineupStatus = 'DRAFT' | 'SUBMITTED' | 'LOCKED' | 'OVERRIDDEN';

export interface BoardPattern {
  id: string;
  name: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'MASTER';
  objective: string;
  validCoins: string[];
  invalidCoins: string[];
  scoringRules: {
    basePoints: number;
    queenBonus: number;
    penaltyPoints: number;
  };
  instructionalMedia?: string;
  diagramUrl?: string;
}

export interface MatchLineupSlot {
  id: string;
  formatType: 'SINGLES' | 'DOUBLES' | 'TRIPLES';
  patternId: string;
  patternName: string;
  playerIds: string[];
  playerNames: string[];
}

export interface MatchLineup {
  id: string;
  matchId: string;
  teamId: string;
  teamName: string;
  captainId: string;
  status: LineupStatus;
  slots: MatchLineupSlot[];
  submittedAt?: string;
  lockedAt?: string;
  overrideNotes?: string;
}

export interface Edition {
  id: string;
  number: number;
  title: string;
  theme?: string;
  posterUrl?: string;
  hints?: string;
  registrationStartDate?: string;
  registrationEndDate?: string;
  tournamentStartDate?: string;
  winnerTeam?: string;
  runnerUpTeam?: string;
  totalTeams: number;
  prizePool: string;
  mvpPlayer?: string;
  format: string;
  bannerImage: string;
  assignedPatterns?: BoardPattern[];
}

export interface User {
  id: string;
  username: string;
  pin?: string;
  isActivated?: boolean;
  name: string;
  email?: string;
  image?: string;
  role: UserRole;
  bio?: string;
  country?: string;
  state?: string;
  city?: string;
  whatsApp?: string;
  rating: number;
  wins: number;
  losses: number;
  queenStrikes: number;
  boardsWon?: number;
  category?: PlayerCategory;
  average?: number;
  target?: number;
  age?: number;
  gender?: string;
  skillScore?: number;
  past3EditionsStats?: {
    editionsPlayed: number;
    avgWinRate: number;
    queensCount: number;
  };
  editionHistory?: {
    editionNumber: number;
    editionTitle: string;
    teamName: string;
    result: string;
  }[];
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  roleInTeam: 'CAPTAIN' | 'PLAYER' | 'SUBSTITUTE';
  user: User;
}

export interface Team {
  id: string;
  name: string;
  tag: string;
  logo?: string;
  description?: string;
  captainId?: string;
  captain?: User;
  members?: TeamMember[];
  stats?: {
    matchesPlayed: number;
    wins: number;
    losses: number;
    winRate: number;
  };
}

export interface TournamentTeam {
  id: string;
  tournamentId: string;
  teamId: string;
  team: Team;
  status: RegistrationStatus;
  registeredAt: string;
}

export interface Match {
  id: string;
  tournamentId: string;
  round: number;
  matchNumber: number;
  stage?: MatchStage;
  team1Id?: string;
  team1?: Team;
  team2Id?: string;
  team2?: Team;
  score1: number;
  score2: number;
  queenStrikes1: number;
  queenStrikes2: number;
  status: MatchStatus;
  winnerId?: string;
  winner?: Team;
  scheduledTime: string;
  tableNumber?: number;
  proofUrl?: string;
  proofNotes?: string;
}

export interface StandingRow {
  rank: number;
  teamId: string;
  teamName: string;
  teamTag: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
  scoreDiff: number;
  queenStrikes: number;
}

export interface Tournament {
  id: string;
  title: string;
  slug: string;
  description: string;
  format: TournamentFormat;
  status: TournamentStatus;
  startDate: string;
  endDate: string;
  prizePool: string;
  maxTeams: number;
  rules?: string;
  bannerImage?: string;
  organizerId: string;
  organizer?: User;
  teams?: TournamentTeam[];
  matches?: Match[];
}

export interface ScoreReport {
  id: string;
  matchId: string;
  submittedByUserId: string;
  submittedBy?: User;
  team1Score: number;
  team2Score: number;
  queenStrikes1: number;
  queenStrikes2: number;
  proofNotes?: string;
  proofUrl?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}
