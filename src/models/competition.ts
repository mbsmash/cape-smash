export interface House {
    id: number;
    name: string;
    displayName: string;
    color: string;
    emblem: string;
    leader?: string;
    description: string;
    points: number;
}

export interface ImportedPlayer {
    id: number; // Unified player ID for the competition system
    tag: string; // Display name/gamer tag
    startggUserId?: number; // Start.gg user ID for linking across tournaments
    tournaments: string[]; // List of tournament slugs this player appeared in
    firstImported: Date; // When this player was first imported
    lastSeen: Date; // When this player was last seen in a tournament
    isAssigned: boolean; // Whether this player is assigned to a house
    assignedHouseId?: number; // House ID if assigned
    tempHouseId?: number; // Temporary house selection for UI
}

export interface HouseAssignment {
    playerId: number;
    playerName: string;
    houseId: number;
    assignedDate: Date;
    isHighLevel: boolean;
}

export interface CompetitionEvent {
    id: number;
    name: string;
    type: 'tournament' | 'grudge_match' | 'special_event';
    date: Date;
    housePoints: { [houseId: number]: number };
    description?: string;
    isCompleted: boolean;
    tournamentSlug?: string; // Reference to source tournament
}

export interface CompetitionSeason {
    id: number;
    name: string;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
    houses: House[];
    events: CompetitionEvent[];
    assignments: HouseAssignment[];
    importedPlayers: ImportedPlayer[];
    rules: SeasonRules;
}

export interface SeasonRules {
    upsetPointsFormula: string;
    winPointsFormula: string;
    grudgeMatchMultiplier: number;
    specialEventMultiplier: number;
}

export interface PlayerCompetitionStats {
    playerId: number;
    playerName: string;
    houseId: number;
    houseName: string;
    totalPoints: number;
    tournamentsWon: number;
    upsetsScored: number;
    grudgeMatchesWon: number;
    eventsParticipated: number;
}
