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

export interface GgSet {
  id: string;
  winnerId: number;
  entrantIds: number[];
}
