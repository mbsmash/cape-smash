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
  round?: number; // Tournament round information
  identifier?: string; // Round identifier like "Grand Final", "Winners Finals", etc.
  fullRoundText?: string; // Complete round description
  displayScore?: string; // Formatted score display
  totalGames?: number; // Number of games in the set
  games?: GgGame[]; // Individual games within the set
  vodUrl?: string; // VOD link if available
  completedAt?: number; // Completion timestamp
}
