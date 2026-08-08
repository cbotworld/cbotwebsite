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

export const OFFICIAL_PLAYERS_RAW = [
  { name: 'ANAS AHMED', average: 4.23, target: 21 },
  { name: 'SUNANDA TAMULI', average: 4.26, target: 20 },
  { name: 'NISHANTHA FERNANDO', average: 4.30, target: 25 },
  { name: 'ISMAILNEAL AZMEEN', average: 4.53, target: 20 },
  { name: 'JAYAKUMAR AP', average: 5.00, target: 20 },
  { name: 'PIERRE DUBOIS', average: 5.00, target: 25 },
  { name: 'SHYAM SUNDAR', average: 5.29, target: 26 },
  { name: 'BALU', average: 5.51, target: 28 },
  { name: 'ANUJ SINHA', average: 5.71, target: 25 },
  { name: 'SUBHO', average: 6.00, target: 30 },
  { name: 'ROHIT PASWAN', average: 6.00, target: 30 },
  { name: 'PRASENJIT', average: 6.25, target: 30 },
  { name: 'LALIT', average: 6.19, target: 32 },
  { name: 'SWAPNIL DESHPANDE', average: 6.40, target: 32 },
  { name: 'YOANN OLIVIER', average: 6.40, target: 32 },
  { name: 'ABHIJIT', average: 6.45, target: 32 },
  { name: 'ABDUL MANNAN', average: 6.74, target: 32 },
  { name: 'CHANDRU', average: 6.77, target: 34 },
  { name: 'AMARNATH PANJIYAR', average: 6.83, target: 34 },
  { name: 'ZIYAD BAWA', average: 6.81, target: 34 },
  { name: 'SATISH DALVI', average: 6.91, target: 35 },
  { name: 'HARIKA JSK', average: 6.91, target: 35 },
  { name: 'SYAM PRAKASH', average: 7.14, target: 36 },
  { name: 'ADITYA SAREPALLI', average: 7.20, target: 36 },
  { name: 'DIN', average: 7.23, target: 36 },
  { name: 'MANSUR ATTAR', average: 7.25, target: 38 },
  { name: 'SUNIL', average: 7.46, target: 37 },
  { name: 'PACKIYA', average: 7.50, target: 30 },
  { name: 'JP JAYARAJ', average: 7.87, target: 40 },
  { name: 'KANNAN', average: 8.00, target: 40 },
  { name: 'AMAR INGLE', average: 8.00, target: 40 },
  { name: 'BALACHANDRA HEGDE', average: 8.00, target: 40 },
  { name: 'VISHAL SHERGAL', average: 8.00, target: 40 },
  { name: 'VAIBHAV JOIL', average: 8.09, target: 40 },
  { name: 'SRIKANTH VETSA', average: 8.25, target: 41 },
  { name: 'AJIT ZIBA', average: 8.43, target: 42 },
  { name: 'VINOD', average: 8.70, target: 47 },
  { name: 'GURMIT SINGH', average: 8.57, target: 43 },
  { name: 'NSK', average: 8.87, target: 43 },
  { name: 'SAJEEVNATH S', average: 8.89, target: 40 },
  { name: 'RAMESH', average: 8.89, target: 44 },
  { name: 'ANANDLAL', average: 8.90, target: 44 },
  { name: 'MOHAN KUMAR D', average: 8.90, target: 44 },
  { name: 'SHASHIREKHA KK', average: 8.97, target: 45 },
  { name: 'V SHIVALKAR', average: 8.97, target: 45 },
  { name: 'AKHIL', average: 9.00, target: 45 },
  { name: 'PRIYA BHAT', average: 9.00, target: 40 },
  { name: 'HEMANTH NS', average: 9.14, target: 46 },
  { name: 'TN MAHESH', average: 9.17, target: 46 },
  { name: 'SRIVISHNU', average: 9.20, target: 46 },
  { name: 'VEERA SEKHAR', average: 9.25, target: 46 },
  { name: 'DEEPAK HEGDE', average: 9.37, target: 47 },
  { name: 'NGUYEN KAKATI', average: 9.37, target: 47 },
  { name: 'ALOK SINGH', average: 9.40, target: 47 },
  { name: 'MOKSHA P', average: 9.45, target: 47 },
  { name: 'SHALINI BHAT', average: 9.51, target: 48 },
  { name: 'SIRAJ', average: 9.80, target: 48 },
  { name: 'SHRIKANT', average: 9.85, target: 48 },
  { name: 'UDIPTA DEKA', average: 9.90, target: 49 },
  { name: 'A KUMAR', average: 9.91, target: 50 },
  { name: 'SREERANJ RS', average: 10.00, target: 50 },
  { name: 'AJAY SINHA', average: 10.36, target: 50 },
  { name: 'PRAMATH', average: 10.36, target: 50 },
  { name: 'SACHIN SURVE', average: 10.36, target: 50 },
  { name: 'KIRAN BHAT', average: 10.50, target: 52 },
  { name: 'GIRISH R', average: 10.51, target: 52 },
  { name: 'PRATHAMESH GHARAT', average: 10.53, target: 50 },
  { name: 'MANJUNATH', average: 10.54, target: 54 },
  { name: 'M PADMAJA', average: 10.82, target: 54 },
  { name: 'RAKESH', average: 10.97, target: 55 },
  { name: 'JYOTI MURTY', average: 11.05, target: 55 },
  { name: 'S KRISHNAMURTHY', average: 11.37, target: 57 },
  { name: 'UWESH N', average: 11.40, target: 57 },
  { name: 'CHARI', average: 11.57, target: 58 },
  { name: 'YUVI', average: 11.43, target: 57 },
  { name: 'POORNIMA', average: 11.50, target: 58 },
  { name: 'RIZWAN NOOR', average: 12.00, target: 60 },
  { name: 'CH SUDHA', average: 12.01, target: 60 },
  { name: 'VAIBHAV PETHE', average: 12.63, target: 64 },
  { name: 'MATHAIS', average: 13.00, target: 65 },
  { name: 'VENKATESWARLU Y', average: 13.14, target: 66 },
  { name: 'KIRAN SOMAN', average: 13.34, target: 67 },
  { name: 'TELVIN THANKACHAN', average: 13.40, target: 67 },
  { name: 'ADARSH SA', average: 13.47, target: 70 },
  { name: 'PRAVEEN N', average: 14.00, target: 70 },
  { name: 'ANIL S', average: 14.52, target: 70 },
  { name: 'MANOJ PS', average: 14.85, target: 73 },
  { name: 'ARUN VENKATESH', average: 14.91, target: 75 },
  { name: 'RK TOLETY', average: 14.24, target: 75 },
  { name: 'V RAJAMANICKAM', average: 14.54, target: 70 },
  { name: 'SUMA NAVEEN', average: 15.30, target: 72 },
  { name: 'SURESH KUMAR', average: 16.00, target: 70 },
  { name: 'PRASANNA KUMAR', average: 15.30, target: 75 },
  { name: 'KRUTIKA', average: 15.33, target: 78 },
  { name: 'VINCY', average: 18.11, target: 91 },
  { name: 'RUBAN', average: 19.10, target: 92 },
  { name: 'RAVI KUMAR S', average: 19.30, target: 84 },
  { name: 'ROHIT PACHIYA', average: 19.34, target: 90 },
  { name: 'NEELA', average: 19.20, target: 90 },
  { name: 'SREEVIDYA R', average: 20.10, target: 100 },
  { name: 'BALWANT SINGH', average: 21.11, target: 106 },
  { name: 'SRIDEVI', average: 21.20, target: 106 },
  { name: 'ELANGOVAN', average: 21.25, target: 100 },
  { name: 'KRISHNA', average: 21.74, target: 105 },
  { name: 'HEMACHANDRA KUMAR T', average: 28.21, target: 140 },
  { name: 'AMARENDAR', average: 30.00, target: 150 },
  { name: 'ANITHA VK', average: 38.50, target: 193 },
  { name: 'SHEKHAR DHARA', average: 0, target: 0 },
  { name: 'TRIVIKRAM', average: 0, target: 0 },
  { name: 'VINEETH VIJAYAPURAM', average: 0, target: 0 },
  { name: 'VIRAJ NAKHAWA', average: 0, target: 0 },
];
export const DELETED_USERNAMES = new Set<string>();

export const MOCK_USERS: User[] = OFFICIAL_PLAYERS_RAW.map((p, idx) => {
  const cleanUsername = p.name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 16);
  return {
    id: `usr_official_${idx + 1}`,
    username: `${cleanUsername}`,
    pin: `${1000 + (idx % 8999)}`,
    isActivated: true,
    name: p.name,
    email: `${cleanUsername}@cbot.gg`,
    role: 'PLAYER' as const,
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
    rating: Math.round(p.average * 100) || 1200,
    average: p.average,
    target: p.target,
    wins: Math.round(p.average * 5),
    losses: Math.round((25 - p.average) / 2),
    queenStrikes: Math.round(p.average * 3),
    boardsWon: Math.round(p.average * 20),
  };
});

export const MOCK_TEAMS: Team[] = [
  {
    id: 'team_200_1',
    name: 'Vintage Strikers',
    tag: 'VS',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/vintage-strikers.jpeg',
    description: 'Precision carrom specialists representing heritage and accuracy.',
    captainId: undefined,
    captain: undefined,
    stats: { matchesPlayed: 184, wins: 148, losses: 36, winRate: 80.4 },
    members: [],
  },
  {
    id: 'team_200_2',
    name: 'Boric Speedsters',
    tag: 'BS',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/boric-speedsters.jpeg',
    description: 'High speed technical carrom strategists with unbeatable velocity.',
    captainId: undefined,
    captain: undefined,
    stats: { matchesPlayed: 172, wins: 134, losses: 38, winRate: 77.9 },
    members: [],
  },
  {
    id: 'team_200_3',
    name: 'Plywood Pioneers',
    tag: 'PP',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/plywood-pioneers.jpeg',
    description: 'Foundational board masters built on solid board play fundamentals.',
    captainId: undefined,
    captain: undefined,
    stats: { matchesPlayed: 150, wins: 110, losses: 40, winRate: 73.3 },
    members: [],
  },
  {
    id: 'team_200_4',
    name: 'Pocket Dynamos',
    tag: 'PD',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/pocket-dynamos.jpeg',
    description: 'Deadly accuracy sharpshooters locking every corner pocket.',
    captainId: undefined,
    captain: undefined,
    stats: { matchesPlayed: 140, wins: 98, losses: 42, winRate: 70.0 },
    members: [],
  },
  {
    id: 'team_200_5',
    name: 'Vanilla Falcons',
    tag: 'VF',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/vanilla-falcons.jpeg',
    description: 'Strategic tacticians dominating complex board layouts.',
    captainId: undefined,
    captain: undefined,
    stats: { matchesPlayed: 130, wins: 88, losses: 42, winRate: 67.7 },
    members: [],
  },
  {
    id: 'team_200_6',
    name: 'Ebony Overlords',
    tag: 'EO',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/ebony-overlords.jpeg',
    description: 'Dominant black coin control and flawless defensive positioning.',
    captainId: undefined,
    captain: undefined,
    stats: { matchesPlayed: 125, wins: 82, losses: 43, winRate: 65.6 },
    members: [],
  },
  {
    id: 'team_200_7',
    name: 'Supernova Queen',
    tag: 'SQ',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/supernova-queen.jpeg',
    description: 'Queen cover champions bringing glory to every board.',
    captainId: undefined,
    captain: undefined,
    stats: { matchesPlayed: 160, wins: 120, losses: 40, winRate: 75.0 },
    members: [],
  },
  {
    id: 'team_200_8',
    name: 'Lumen Pillar',
    tag: 'LP',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/lumen-pillar.jpeg',
    description: 'Illuminating precision strikers guiding their team to victory.',
    captainId: undefined,
    captain: undefined,
    stats: { matchesPlayed: 115, wins: 75, losses: 40, winRate: 65.2 },
    members: [],
  },
];

export const MOCK_EDITIONS: Edition[] = [
  {
    id: 'ed_200',
    number: 200,
    title: 'Cornerstones of Carrom',
    theme: 'Cornerstones of Carrom',
    posterUrl: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/supernova-queen.jpeg',
    hints: 'Focus on Pattern #1 Queen Cover Combos on Board 1 & 2. Double rebound shots award +4 points.',
    registrationStartDate: '2026-08-01',
    registrationEndDate: '2026-08-09',
    tournamentStartDate: '2026-08-10',
    winnerTeam: 'Pending Finals',
    runnerUpTeam: 'Pending Finals',
    totalTeams: 8,
    prizePool: '₹2,00,000 INR',
    mvpPlayer: 'TBD',
    format: 'SINGLE_ELIMINATION',
    bannerImage: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=600',
    assignedPatterns: MOCK_PATTERN_LIBRARY.slice(0, 5),
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
    title: 'Cornerstones of Carrom (Edition #200) Announced with Record ₹2,00,000 Prize Pool',
    slug: 'cornerstones-of-carrom-announced',
    category: 'ANNOUNCEMENT',
    date: '2026-08-05',
    author: 'CBOT Editorial Team',
    excerpt: 'The 200th official edition of Carrom Balu Online Tournament is set to begin next week featuring 8 top teams.',
    content: 'Carrom Balu Online Tournament (CBOT) officially announces its 200th landmark edition: Cornerstones of Carrom. Featuring a prize pool of ₹2,00,000 INR, Edition #200 will test the finest strikers in a multi-format round robin playoffs format.',
    image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=800',
  },
];

export const MOCK_GALLERY: GalleryItem[] = [
  {
    id: 'gal_1',
    title: 'Bicentennial Edition #200 Trophy Presentation',
    category: 'CEREMONY',
    date: 'August 2026',
    imageUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&q=80&w=600',
    caption: 'Balu Master presenting the Edition #200 Championship Trophy.',
  },
];

export const MOCK_TOURNAMENTS: Tournament[] = [
  {
    id: 'tour_1',
    title: 'Cornerstones of Carrom (Edition #200)',
    slug: 'cornerstones-of-carrom',
    description: 'The landmark 200th online carrom championship featuring 8 elite teams competing for the coveted Balu Cup trophy.',
    format: 'SINGLE_ELIMINATION',
    status: 'IN_PROGRESS',
    startDate: '2026-08-10T10:00:00Z',
    endDate: '2026-08-15T18:00:00Z',
    prizePool: '₹2,00,000 INR',
    maxTeams: 8,
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
