export interface GgTournament {
  id: number;
  name: string;
  slug: string;
}

export interface GgPlayer {
  id: number;
  tag: string;
}

export interface GgSet {
  id: string;
  winnerId: number;
  entrantIds: number[];
}
