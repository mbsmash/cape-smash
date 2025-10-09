export interface GgTournament {
  id: number;
  name: string;
  slug: string;
}

export interface GgPlayer {
  id: number;
  tag: string;
  userId?: number; // start.gg user ID for player identification
}

export interface GgCharacter {
  id: number;
  name: string;
}

export interface GgStage {
  id: number;
  name: string;
}

export interface GgGameSelection {
  character?: GgCharacter;
  entrantId: number;
}

export interface GgGame {
  orderNum: number;
  entrant1Score: number;
  entrant2Score: number;
  selections: GgGameSelection[];
}

export interface GgSet {
  id: string;
  winnerId: number;
  entrantIds: number[];
  entrantNames?: string[]; // Player names from start.gg
  round?: number; // Tournament round information
  identifier?: string; // Round identifier like "Grand Final", "Winners Finals", etc.
  fullRoundText?: string; // Complete round description
  displayScore?: string; // Formatted score display
  totalGames?: number; // Number of games in the set
  games?: GgGame[]; // Individual games within the set
  vodUrl?: string; // VOD link if available
  completedAt?: number; // Completion timestamp
}

export interface TournamentData {
  tournament: GgTournament;
  events: TournamentEvent[];
  players: PlayerPerformance[];
  headToHeadMatrix: HeadToHeadRecord[];
  skillRatings: SkillRating[];
  importedAt: Date;
  eventCount: number;
  playerCount: number;
}

export interface TournamentEvent {
  id: number;
  name: string;
  numEntrants: number;
  startAt: number;
  endAt?: number;
  sets: GgSet[];
  placement: PlayerPlacement[];
}

export interface PlayerPerformance {
  id: number;
  tag: string;
  userId?: number;
  events: EventPerformance[];
  overallStats: PerformanceStats;
  skillRating: number;
  consistency: number;
  upsetPotential: number;
}

export interface EventPerformance {
  eventId: number;
  eventName: string;
  placement: number;
  totalEntrants: number;
  sets: SetRecord[];
  stats: PerformanceStats;
}

export interface SetRecord {
  setId: string;
  opponentId: number;
  opponentTag: string;
  result: 'win' | 'loss';
  score: string;
  round: string;
  gameScore: { wins: number; losses: number };
}

export interface PerformanceStats {
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  winRate: number;
  gameWinRate: number;
  upsets: number; // Wins against higher-seeded players
  badLosses: number; // Losses to lower-seeded players
  averagePlacement: number;
  bestPlacement: number;
  worstPlacement: number;
}

export interface HeadToHeadRecord {
  player1Id: number;
  player1Tag: string;
  player2Id: number;
  player2Tag: string;
  player1Wins: number;
  player2Wins: number;
  totalSets: number;
  lastSetDate?: Date;
  gameRecord: { player1Games: number; player2Games: number };
  contexts: SetContext[];
}

export interface SetContext {
  eventName: string;
  round: string;
  date: Date;
  winner: 'player1' | 'player2';
  score: string;
}

export interface SkillRating {
  playerId: number;
  playerTag: string;
  rating: number;
  confidence: number;
  trend: 'improving' | 'stable' | 'declining';
  recentForm: number; // Rating based on last 5 sets
  peakRating: number;
  rankingPosition: number;
  estimatedSkillRange: { min: number; max: number };
}

export interface PlayerPlacement {
  playerId: number;
  playerTag: string;
  placement: number;
  seed?: number;
  eliminated?: boolean;
}

export interface ImportRequest {
  tournamentUrl: string;
  importEvents: boolean;
  calculateRatings: boolean;
  mergeWithExisting: boolean;
}

export interface ImportResult {
  success: boolean;
  message: string;
  data?: TournamentData;
  errors?: string[];
  warnings?: string[];
}
