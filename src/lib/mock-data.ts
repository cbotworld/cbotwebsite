import { Tournament, Team, User, Match, ScoreReport, BoardPattern, Edition } from '@/types';

export interface HallOfFameMember {
  id: string;
  name: string;
  title: string;
  editionsWon: number;
  inductionYear: number;
  avatar: string;
  bio: string;
  achievement: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  category: 'ANNOUNCEMENT' | 'RULES' | 'INTERVIEW' | 'HIGHLIGHTS';
  date: string;
  author: string;
  excerpt: string;
  content: string;
  image: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  category: 'FINALS' | 'CEREMONY' | 'COMMUNITY' | 'BOARD_ACTION';
  date: string;
  imageUrl: string;
  caption: string;
}

export const MOCK_PATTERN_LIBRARY: BoardPattern[] = [
  {
    id: 'pattern_1',
    name: 'Pattern #1: Queen Cover Combo',
    difficulty: 'HARD',
    objective: 'Pocket the Queen and cover it with a white coin in 1 continuous strike.',
    validCoins: ['QUEEN', 'WHITE_COIN'],
    invalidCoins: ['BLACK_COIN'],
    scoringRules: { basePoints: 5, queenBonus: 3, penaltyPoints: 2 },
    instructionalMedia: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=400',
    diagramUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'pattern_2',
    name: 'Pattern #2: Double Rebound Bank Shot',
    difficulty: 'MASTER',
    objective: 'Bounce the striker off two frame cushions to pocket the target white coin.',
    validCoins: ['WHITE_COIN'],
    invalidCoins: ['QUEEN', 'BLACK_COIN'],
    scoringRules: { basePoints: 4, queenBonus: 0, penaltyPoints: 1 },
    instructionalMedia: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=400',
    diagramUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'pattern_3',
    name: 'Pattern #3: Corner Pocket Lockout',
    difficulty: 'MEDIUM',
    objective: 'Clear 3 black coins from the top-left corner pocket zone.',
    validCoins: ['BLACK_COIN'],
    invalidCoins: ['WHITE_COIN'],
    scoringRules: { basePoints: 3, queenBonus: 0, penaltyPoints: 1 },
    instructionalMedia: 'https://images.unsplash.com/photo-1614036417651-efe5912149d8?auto=format&fit=crop&q=80&w=400',
    diagramUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'pattern_4',
    name: 'Pattern #4: Front Finger Speed Blitz',
    difficulty: 'EASY',
    objective: 'Pocket any 2 valid coins within 15 seconds.',
    validCoins: ['WHITE_COIN', 'BLACK_COIN'],
    invalidCoins: [],
    scoringRules: { basePoints: 2, queenBonus: 3, penaltyPoints: 0 },
    instructionalMedia: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&q=80&w=400',
    diagramUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'pattern_5',
    name: 'Pattern #5: Balu Special 360 Spin',
    difficulty: 'MASTER',
    objective: 'Spin striker 360 degrees off center circle to pocket queen and last white coin.',
    validCoins: ['QUEEN', 'WHITE_COIN'],
    invalidCoins: ['BLACK_COIN'],
    scoringRules: { basePoints: 6, queenBonus: 5, penaltyPoints: 3 },
    instructionalMedia: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=400',
    diagramUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&q=80&w=400',
  },
];

export const MOCK_USERS: User[] = [
  {
    id: 'usr_organizer_1',
    username: 'balumaster',
    pin: '9999',
    isActivated: true,
    name: 'Balu Master (Carrom Balu)',
    email: 'balu@cbot.gg',
    role: 'ORGANIZER',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
    bio: 'Founder of CBOT (August 2020). 20+ years of Carrom championship experience.',
    rating: 2450,
    wins: 340,
    losses: 45,
    queenStrikes: 188,
    boardsWon: 1240,
  },
  {
    id: 'usr_captain_1',
    username: 'striker_vikram',
    pin: '1234',
    isActivated: true,
    name: 'Vikram "Striker" R',
    email: 'vikram@strikerkings.com',
    role: 'CAPTAIN',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
    bio: 'Captain of Striker Kings. 14-time CBOT Edition Winner.',
    rating: 2180,
    wins: 148,
    losses: 22,
    queenStrikes: 114,
    boardsWon: 610,
  },
  {
    id: 'usr_captain_2',
    username: 'queen_ananya',
    pin: '5678',
    isActivated: true,
    name: 'Ananya "Pocket Queen" S',
    email: 'ananya@queenchargers.com',
    role: 'CAPTAIN',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
    bio: 'Captain of Queen Chargers. National carrom silver medalist.',
    rating: 2120,
    wins: 134,
    losses: 18,
    queenStrikes: 102,
    boardsWon: 580,
  },
  {
    id: 'usr_player_1',
    username: 'rajesh_cbot',
    pin: '1111',
    isActivated: true,
    name: 'Rajesh Kumar',
    email: 'rajesh@cbot.gg',
    role: 'PLAYER',
    image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=200',
    bio: 'Aggressive front-finger carrom player. Striker Kings core line-up.',
    rating: 1740,
    wins: 65,
    losses: 30,
    queenStrikes: 48,
    boardsWon: 295,
  },
];

export const MOCK_TEAMS: Team[] = [
  {
    id: 'team_1',
    name: 'Striker Kings',
    tag: 'SK',
    logo: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=150',
    description: 'Reigning CBOT Champions known for aggressive queen pocketing and flawless finish.',
    captainId: 'usr_captain_1',
    captain: MOCK_USERS[1],
    stats: { matchesPlayed: 184, wins: 148, losses: 36, winRate: 80.4 },
    members: [
      { id: 'tm_1', teamId: 'team_1', userId: 'usr_captain_1', roleInTeam: 'CAPTAIN', user: MOCK_USERS[1] },
      { id: 'tm_2', teamId: 'team_1', userId: 'usr_player_1', roleInTeam: 'PLAYER', user: MOCK_USERS[3] },
    ],
  },
  {
    id: 'team_2',
    name: 'Queen Chargers',
    tag: 'QC',
    logo: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&q=80&w=150',
    description: 'High-speed technical carrom strategists with an unbeatable queen conversion record.',
    captainId: 'usr_captain_2',
    captain: MOCK_USERS[2],
    stats: { matchesPlayed: 172, wins: 134, losses: 38, winRate: 77.9 },
    members: [
      { id: 'tm_3', teamId: 'team_2', userId: 'usr_captain_2', roleInTeam: 'CAPTAIN', user: MOCK_USERS[2] },
    ],
  },
];

export const MOCK_EDITIONS: Edition[] = [
  {
    id: 'ed_205',
    number: 205,
    title: 'CBOT Edition #205 - Grand Masters Cup 2026',
    theme: 'Monsoon Gold & Amber Glass',
    posterUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=600',
    hints: 'Focus on Pattern #1 Queen Cover Combos on Board 1 & 2. Double rebound shots award +4 points.',
    registrationStartDate: '2026-08-01',
    registrationEndDate: '2026-08-09',
    tournamentStartDate: '2026-08-10',
    winnerTeam: 'Pending Finals',
    runnerUpTeam: 'Pending Finals',
    totalTeams: 16,
    prizePool: '₹2,00,000 INR',
    mvpPlayer: 'TBD',
    format: 'SINGLE_ELIMINATION',
    bannerImage: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=600',
    assignedPatterns: MOCK_PATTERN_LIBRARY.slice(0, 5),
  },
  {
    id: 'ed_204',
    number: 204,
    title: 'CBOT Edition #204 - Monsoon Masters 2026',
    theme: 'Crimson Slate',
    posterUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=600',
    hints: 'Corner Pocket Lockout patterns strictly enforced.',
    registrationStartDate: '2026-07-20',
    registrationEndDate: '2026-07-31',
    tournamentStartDate: '2026-08-01',
    winnerTeam: 'Striker Kings',
    runnerUpTeam: 'Queen Chargers',
    totalTeams: 16,
    prizePool: '₹1,50,000 INR',
    mvpPlayer: 'Vikram "Striker" R',
    format: 'SINGLE_ELIMINATION',
    bannerImage: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=600',
    assignedPatterns: MOCK_PATTERN_LIBRARY.slice(0, 4),
  },
];

export const MOCK_HALL_OF_FAME: HallOfFameMember[] = [
  {
    id: 'hof_1',
    name: 'Balu Master (Carrom Balu)',
    title: 'Founder & Legend of CBOT',
    editionsWon: 28,
    inductionYear: 2022,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
    bio: 'Pioneered digital Carrom tournament standards in August 2020. 28-time individual and team champion.',
    achievement: 'First player to pocket 1,000+ career queens in CBOT history.',
  },
];

export const MOCK_NEWS: NewsArticle[] = [
  {
    id: 'news_1',
    title: 'CBOT Edition #205 Announced with Record ₹2,00,000 Prize Pool',
    slug: 'cbot-edition-205-announced',
    category: 'ANNOUNCEMENT',
    date: '2026-08-05',
    author: 'CBOT Editorial Team',
    excerpt: 'The 205th official edition of Carrom Balu Online Tournament is set to begin next week featuring 16 top teams.',
    content: 'Carrom Balu Online Tournament (CBOT) officially announces its 205th landmark edition. Featuring a prize pool of ₹2,00,000 INR, Edition #205 will test the finest strikers across India in a single elimination format.',
    image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=800',
  },
];

export const MOCK_GALLERY: GalleryItem[] = [
  {
    id: 'gal_1',
    title: 'Bicentennial Edition #200 Trophy Presentation',
    category: 'CEREMONY',
    date: 'May 2026',
    imageUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&q=80&w=600',
    caption: 'Balu Master presenting the Edition #200 Championship Trophy to Striker Kings.',
  },
];

export const MOCK_TOURNAMENTS: Tournament[] = [
  {
    id: 'tour_1',
    title: 'Carrom Balu Grand Masters Cup 2026 (Edition #205)',
    slug: 'carrom-balu-grand-masters-cup-2026',
    description: 'The flagship online carrom championship featuring 16 elite teams competing for the coveted Balu Cup trophy.',
    format: 'SINGLE_ELIMINATION',
    status: 'IN_PROGRESS',
    startDate: '2026-08-10T10:00:00Z',
    endDate: '2026-08-15T18:00:00Z',
    prizePool: '₹2,00,000 INR',
    maxTeams: 16,
    bannerImage: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=1200',
    organizerId: 'usr_organizer_1',
    organizer: MOCK_USERS[0],
    rules: 'Best of 3 Boards per match. Official Synco Carrom Board Powder standard. Queen cover mandatory within 1 strike.',
    teams: [
      { id: 'tt_1', tournamentId: 'tour_1', teamId: 'team_1', team: MOCK_TEAMS[0], status: 'APPROVED', registeredAt: '2026-08-01' },
      { id: 'tt_2', tournamentId: 'tour_1', teamId: 'team_2', team: MOCK_TEAMS[1], status: 'APPROVED', registeredAt: '2026-08-02' },
    ],
  },
];

export const MOCK_MATCHES: Match[] = [
  {
    id: 'match_101',
    tournamentId: 'tour_1',
    round: 1,
    matchNumber: 1,
    team1Id: 'team_1',
    team1: MOCK_TEAMS[0],
    team2Id: 'team_2',
    team2: MOCK_TEAMS[1],
    score1: 25,
    score2: 12,
    queenStrikes1: 3,
    queenStrikes2: 1,
    status: 'COMPLETED',
    winnerId: 'team_1',
    winner: MOCK_TEAMS[0],
    scheduledTime: '2026-08-10T11:00:00Z',
    tableNumber: 1,
    proofNotes: 'Verified score via live video stream. SK dominated board 2 with 2 queen conversions.',
  },
  {
    id: 'match_201',
    tournamentId: 'tour_1',
    round: 2,
    matchNumber: 1,
    team1Id: 'team_1',
    team1: MOCK_TEAMS[0],
    team2Id: 'team_2',
    team2: MOCK_TEAMS[1],
    score1: 14,
    score2: 16,
    queenStrikes1: 2,
    queenStrikes2: 3,
    status: 'LIVE',
    scheduledTime: '2026-08-11T16:00:00Z',
    tableNumber: 1,
    proofNotes: 'Live Final Match in Progress! Queen Chargers leads 16-14 in Board 3.',
  },
];

export const MOCK_SCORE_REPORTS: ScoreReport[] = [
  {
    id: 'sr_1',
    matchId: 'match_201',
    submittedByUserId: 'usr_captain_2',
    submittedBy: MOCK_USERS[2],
    team1Score: 14,
    team2Score: 16,
    queenStrikes1: 2,
    queenStrikes2: 3,
    proofNotes: 'Captain Ananya submitted board 3 score with video recording link attached.',
    proofUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=400',
    status: 'PENDING',
    createdAt: '2026-08-11T16:45:00Z',
  },
];
