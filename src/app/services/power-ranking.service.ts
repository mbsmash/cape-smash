import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GgPlayer, GgSet } from 'src/models/startgg';
import { StartggService } from './startgg.service';
import { Rating, TrueSkill } from 'ts-trueskill';

export interface PlayerRecord {
  id: number;
  tag: string;
  wins: number;
  losses: number;
  appearances: number;
  headToHead: { [opponentId: number]: { wins: number; losses: number } };
  startggUserId?: number; // start.gg user ID for player identification
  trueskillRating: Rating; // TrueSkill rating (internal calculation)
  ratingHistory: Array<{ rating: Rating; timestamp: number; tournament?: string }>; // Rating progression over time
  points: number; // Display points derived from TrueSkill (resets each season)
}

/**
 * PowerRankingService handles player records and power rankings data.
 * 
 * Features:
 * - Track player wins, losses, and tournament appearances
 * - Import tournaments from start.gg using tournament slugs
 * - Merge player data using start.gg user IDs to handle name changes
 * - Calculate head-to-head records between players
 * - TrueSkill rating system with retroactive calculation
 * - Persist data to localStorage for season continuity
 * 
 * Usage:
 * - importTournament('tournament-slug') to import data from start.gg
 * - getRecords() to get current rankings sorted by TrueSkill rating
 * - getFilteredRecords() to get rankings with 2+ appearance filter
 * - insertTestRecords() to create synthetic test data (for development)
 * - clearRecords() to clear all data
 * - recalculateTrueSkillRatings() to retroactively apply TrueSkill to existing data
 */
@Injectable({
  providedIn: 'root'
})
export class PowerRankingService {
  private records = new Map<number, PlayerRecord>();
  private readonly STORAGE_KEY = 'cape-smash-power-rankings';
  private trueskill: TrueSkill;
  private tournamentHistory: Array<{ sets: GgSet[]; playerMap: Map<number, number>; tournamentName?: string; timestamp: number }> = [];

  constructor(private startgg: StartggService) {
    // Initialize TrueSkill with standard settings (μ=25, σ=8.333, β=4.167, τ=0.083)
    this.trueskill = new TrueSkill();
    // Load persisted data on startup
    this.loadFromStorage();
  }

  getRecord(id: number): PlayerRecord | undefined {
    return this.records.get(id);
  }

  getRecords(): PlayerRecord[] {
    return Array.from(this.records.values()).sort((a, b) => {
      // Sort by points (higher is better)
      if (Math.abs(a.points - b.points) > 0.01) {
        return b.points - a.points;
      }
      
      // Fallback to win rate if points are very close
      const awr = a.wins / Math.max(1, a.wins + a.losses);
      const bwr = b.wins / Math.max(1, b.wins + b.losses);
      if (awr === bwr) return b.wins - a.wins;
      return bwr - awr;
    });
  }

  getFilteredRecords(): PlayerRecord[] {
    const allRecords = this.getRecords();
    
    // Check if we should apply the 2+ appearances filter
    const maxAppearances = Math.max(...allRecords.map(r => r.appearances), 0);
    
    // If the maximum appearances is 1 or less, show everyone
    // Otherwise, only show players with 2+ appearances
    if (maxAppearances <= 1) {
      return allRecords;
    } else {
      return allRecords.filter(record => record.appearances >= 2);
    }
  }

  clearRecords(): void {
    this.records.clear();
    this.tournamentHistory = [];
    this.saveToStorage();
  }

  /**
   * Convert TrueSkill rating to Braacket-style points
   * Base formula: (TrueSkill Conservative Rating * 200) + 1000
   * This gives us a points range similar to Braacket (roughly 1000-7000)
   */
  private calculatePointsFromTrueSkill(rating: Rating): number {
    // Conservative TrueSkill estimate: μ - 3σ
    const conservativeRating = rating.mu - (3 * rating.sigma);
    
    // Convert to points scale similar to Braacket
    // Base points: 1000, scale factor: 200
    // This means a 25.0 TrueSkill (~0 conservative) = 1000 points
    // Higher skilled players can reach 4000-7000+ points
    const points = Math.round((conservativeRating * 200) + 1000);
    
    // Ensure minimum of 0 points
    return Math.max(0, points);
  }

  private createPlayerRecord(player: { id: number; tag: string }, startggUserId?: number): PlayerRecord {
    const initialRating = this.trueskill.createRating();
    return {
      id: player.id,
      tag: player.tag,
      wins: 0,
      losses: 0,
      appearances: 0,
      headToHead: {},
      startggUserId: startggUserId,
      trueskillRating: initialRating,
      ratingHistory: [{ rating: initialRating, timestamp: Date.now() }],
      points: this.calculatePointsFromTrueSkill(initialRating)
    };
  }

  async computeSeason(eventIds: number[]): Promise<PlayerRecord[]> {
    this.records.clear();
    for (const id of eventIds) {
      const players = await firstValueFrom(this.startgg.getPlayers(id));
      const sets = await firstValueFrom(this.startgg.getSets(id));
      players.forEach(p => this.ensureRecord(p));
      this.processSets(sets);
      players.forEach(p => {
        const rec = this.records.get(p.id)!;
        rec.appearances++;
      });
    }
    this.saveToStorage(); // Save to storage after season computation
    return this.getRecords();
  }

  async importTournament(tournamentSlug: string): Promise<PlayerRecord[]> {
    try {
      console.log(`Starting import for tournament: ${tournamentSlug}`);
      const eventIds = await firstValueFrom(this.startgg.getTournamentEvents(tournamentSlug));
      console.log(`Found ${eventIds.length} events:`, eventIds);
      
      const tournamentTimestamp = Date.now();
      
      for (const eventId of eventIds) {
        console.log(`Processing event ${eventId}`);
        const players = await firstValueFrom(this.startgg.getPlayers(eventId));
        const sets = await firstValueFrom(this.startgg.getSets(eventId));
        console.log(`Found ${players.length} players and ${sets.length} sets`);
        
        // Create a mapping of tournament player IDs to existing player records
        const playerIdMap = new Map<number, number>();
        
        // Ensure records exist for all players, merging with existing if found by startggUserId
        players.forEach(p => {
          let existingRecord = this.findRecordByUserId(p.userId);
          
          if (existingRecord) {
            // Map tournament player ID to existing record ID
            playerIdMap.set(p.id, existingRecord.id);
            // Update the tag if it has changed
            existingRecord.tag = p.tag;
          } else {
            // Create new record
            this.ensureRecordWithUserTracking(p);
            playerIdMap.set(p.id, p.id);
          }
        });
        
        // Store tournament data for retroactive TrueSkill calculation
        this.tournamentHistory.push({
          sets: sets,
          playerMap: playerIdMap,
          tournamentName: tournamentSlug,
          timestamp: tournamentTimestamp
        });
        
        // Process sets with mapped player IDs (this now includes TrueSkill updates)
        this.processSetsWithMapping(sets, playerIdMap);
        
        // Increment appearances for all participants
        players.forEach(p => {
          const mappedId = playerIdMap.get(p.id);
          const record = mappedId ? this.records.get(mappedId) : undefined;
          if (record) {
            record.appearances++;
          }
        });
        
        // Add rating history entry for all participants
        players.forEach(p => {
          const mappedId = playerIdMap.get(p.id);
          const record = mappedId ? this.records.get(mappedId) : undefined;
          if (record) {
            record.ratingHistory.push({
              rating: record.trueskillRating,
              timestamp: tournamentTimestamp,
              tournament: tournamentSlug
            });
          }
        });
      }
      
      console.log(`Import completed successfully. Total records: ${this.records.size}`);
      this.saveToStorage(); // Save to storage after successful import
      return this.getRecords();
    } catch (error) {
      console.error('Error importing tournament:', error);
      // Re-throw with more context
      if (error instanceof Error) {
        throw new Error(`Failed to import tournament "${tournamentSlug}": ${error.message}`);
      } else {
        throw new Error(`Failed to import tournament "${tournamentSlug}": Unknown error occurred`);
      }
    }
  }

  private ensureRecord(p: GgPlayer): void {
    if (!this.records.has(p.id)) {
      this.records.set(p.id, this.createPlayerRecord(p));
    }
  }

  private ensureRecordWithUserTracking(p: GgPlayer): void {
    let record = this.records.get(p.id);
    if (!record) {
      record = this.createPlayerRecord(p, p.userId);
      this.records.set(p.id, record);
    } else if (p.userId && !record.startggUserId) {
      // If the record exists but without a user ID, update it
      record.startggUserId = p.userId;
    }
  }

  private findRecordByUserId(userId?: number): PlayerRecord | undefined {
    if (!userId) return undefined;
    return Array.from(this.records.values()).find(record => record.startggUserId === userId);
  }

  private processSets(sets: GgSet[]): void {
    for (const s of sets) {
      if (s.entrantIds.length < 2) continue;
      const [p1, p2] = s.entrantIds;
      const winner = s.winnerId;
      const loser = winner === p1 ? p2 : p1;
      const wRec = this.records.get(winner)!;
      const lRec = this.records.get(loser)!;
      wRec.wins++;
      lRec.losses++;
      this.updateH2h(wRec, loser, true);
      this.updateH2h(lRec, winner, false);
    }
  }

  private processSetsWithMapping(sets: GgSet[], playerIdMap: Map<number, number>): void {
    for (const s of sets) {
      if (s.entrantIds.length < 2) continue;
      const [p1, p2] = s.entrantIds;
      const winner = s.winnerId;
      const loser = winner === p1 ? p2 : p1;
      
      // Map tournament player IDs to actual record IDs
      const mappedWinner = playerIdMap.get(winner) || winner;
      const mappedLoser = playerIdMap.get(loser) || loser;
      
      const wRec = this.records.get(mappedWinner);
      const lRec = this.records.get(mappedLoser);
      
      if (wRec && lRec) {
        wRec.wins++;
        lRec.losses++;
        this.updateH2h(wRec, mappedLoser, true);
        this.updateH2h(lRec, mappedWinner, false);
        
        // Update TrueSkill ratings
        this.updateTrueSkillRatings(mappedWinner, mappedLoser);
      }
    }
  }

  private updateH2h(rec: PlayerRecord, oppId: number, win: boolean): void {
    if (!rec.headToHead[oppId]) {
      rec.headToHead[oppId] = { wins: 0, losses: 0 };
    }
    if (win) {
      rec.headToHead[oppId].wins++;
    } else {
      rec.headToHead[oppId].losses++;
    }
  }

  insertTestRecords(): PlayerRecord[] {
    this.records.clear();
    this.tournamentHistory = [];
    
    const testPlayers = [
      { id: 1, tag: 'Echo' },
      { id: 2, tag: 'Hampter' },
      { id: 3, tag: 'Nodeino' },
      { id: 4, tag: 'Watr' },
      { id: 5, tag: 'Vope' },
      { id: 6, tag: 'Kachow' },
      { id: 7, tag: 'Xpression' },
      { id: 8, tag: 'Juno' },
      { id: 9, tag: 'MB' },
      { id: 10, tag: 'Dawson' },
      { id: 11, tag: 'Hypethetic' }
    ];

    testPlayers.forEach((player, index) => {
      // Create records with initial TrueSkill ratings
      const record = this.createPlayerRecord(player);
      // Set some basic win/loss data but we'll calculate TrueSkill properly from sets
      const totalGames = 20;
      const wins = Math.max(1, totalGames - index * 2);
      const losses = totalGames - wins;
      
      record.wins = wins;
      record.losses = losses;
      record.appearances = 5;
      
      this.records.set(player.id, record);
    });

    // Add some sample head-to-head data and simulate TrueSkill calculation
    this.addSampleHeadToHeadData();
    this.simulateTrueSkillForTestData();

    this.saveToStorage(); // Save test data to storage
    return this.getRecords();
  }

  private addSampleHeadToHeadData(): void {
    // Echo vs Hampter
    this.updateH2h(this.records.get(1)!, 2, true);
    this.updateH2h(this.records.get(2)!, 1, false);
    this.updateH2h(this.records.get(1)!, 2, true);
    this.updateH2h(this.records.get(2)!, 1, false);
    this.updateH2h(this.records.get(1)!, 2, false);
    this.updateH2h(this.records.get(2)!, 1, true);

    // Echo vs Nodeino
    this.updateH2h(this.records.get(1)!, 3, true);
    this.updateH2h(this.records.get(3)!, 1, false);
    this.updateH2h(this.records.get(1)!, 3, true);
    this.updateH2h(this.records.get(3)!, 1, false);

    // Hampter vs Watr
    this.updateH2h(this.records.get(2)!, 4, true);
    this.updateH2h(this.records.get(4)!, 2, false);
    this.updateH2h(this.records.get(2)!, 4, false);
    this.updateH2h(this.records.get(4)!, 2, true);
    this.updateH2h(this.records.get(2)!, 4, false);
    this.updateH2h(this.records.get(4)!, 2, true);

    // Add a few more matchups for interesting data
    this.updateH2h(this.records.get(1)!, 5, true);
    this.updateH2h(this.records.get(5)!, 1, false);
    
    this.updateH2h(this.records.get(3)!, 4, true);
    this.updateH2h(this.records.get(4)!, 3, false);
    this.updateH2h(this.records.get(3)!, 4, true);
    this.updateH2h(this.records.get(4)!, 3, false);
    this.updateH2h(this.records.get(3)!, 4, false);
    this.updateH2h(this.records.get(4)!, 3, true);
  }

  private simulateTrueSkillForTestData(): void {
    // Create some simulated matches based on head-to-head data to calculate TrueSkill
    const matches = [
      { winner: 1, loser: 2 }, { winner: 1, loser: 2 }, { winner: 2, loser: 1 },
      { winner: 1, loser: 3 }, { winner: 1, loser: 3 },
      { winner: 2, loser: 4 }, { winner: 4, loser: 2 }, { winner: 4, loser: 2 },
      { winner: 1, loser: 5 },
      { winner: 3, loser: 4 }, { winner: 3, loser: 4 }, { winner: 4, loser: 3 }
    ];

    // Apply TrueSkill updates for these matches
    matches.forEach(match => {
      this.updateTrueSkillRatings(match.winner, match.loser);
    });

    // Add rating history entries for all players
    Array.from(this.records.values()).forEach(record => {
      record.ratingHistory.push({
        rating: record.trueskillRating,
        timestamp: Date.now(),
        tournament: 'Test Data'
      });
    });
  }

  private updateTrueSkillRatings(winnerId: number, loserId: number, tournamentName?: string): void {
    const winner = this.records.get(winnerId);
    const loser = this.records.get(loserId);
    
    if (!winner || !loser) return;

    // Calculate new ratings using TrueSkill
    const [newWinnerRating, newLoserRating] = this.trueskill.rate([
      [winner.trueskillRating],
      [loser.trueskillRating]
    ], [0, 1]); // 0 = first place (winner), 1 = second place (loser)

    // Update player ratings
    winner.trueskillRating = newWinnerRating[0];
    loser.trueskillRating = newLoserRating[0];

    // Update points based on new TrueSkill ratings
    winner.points = this.calculatePointsFromTrueSkill(winner.trueskillRating);
    loser.points = this.calculatePointsFromTrueSkill(loser.trueskillRating);

    // Add to rating history
    const timestamp = Date.now();
    winner.ratingHistory.push({ rating: winner.trueskillRating, timestamp, tournament: tournamentName });
    loser.ratingHistory.push({ rating: loser.trueskillRating, timestamp, tournament: tournamentName });
  }

  recalculateTrueSkillRatings(): void {
    console.log('Recalculating TrueSkill ratings from tournament history...');
    
    // Reset all ratings to initial values
    Array.from(this.records.values()).forEach(record => {
      record.trueskillRating = this.trueskill.createRating();
      record.ratingHistory = [{ rating: record.trueskillRating, timestamp: 0 }];
      record.points = this.calculatePointsFromTrueSkill(record.trueskillRating); // Reset points to initial value
    });

    // Replay all tournaments in chronological order
    this.tournamentHistory
      .sort((a, b) => a.timestamp - b.timestamp)
      .forEach(tournament => {
        console.log(`Applying TrueSkill for tournament: ${tournament.tournamentName || 'Unknown'}`);
        this.applyTrueSkillToSets(tournament.sets, tournament.playerMap, tournament.tournamentName);
      });

    this.saveToStorage();
    console.log('TrueSkill recalculation complete');
  }

  private applyTrueSkillToSets(sets: GgSet[], playerMap: Map<number, number>, tournamentName?: string): void {
    sets.forEach(set => {
      if (set.entrantIds.length < 2) return;
      
      const [p1, p2] = set.entrantIds;
      const winner = set.winnerId;
      const loser = winner === p1 ? p2 : p1;
      
      // Map tournament player IDs to actual record IDs
      const mappedWinner = playerMap.get(winner) || winner;
      const mappedLoser = playerMap.get(loser) || loser;
      
      this.updateTrueSkillRatings(mappedWinner, mappedLoser, tournamentName);
    });
  }

  private loadFromStorage(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        const records = data.records || data; // Handle both old and new format
        const tournamentHistory = data.tournamentHistory || [];
        
        this.records.clear();
        
        // Reconstruct tournament history with proper Map objects
        this.tournamentHistory = tournamentHistory.map((tournament: any) => ({
          ...tournament,
          playerMap: new Map(tournament.playerMap ? Object.entries(tournament.playerMap).map(([k, v]) => [Number(k), Number(v)]) : [])
        }));
        
        records.forEach((record: any) => {
          // Convert plain objects back to Rating instances
          if (record.trueskillRating && record.trueskillRating.mu !== undefined && record.trueskillRating.sigma !== undefined) {
            record.trueskillRating = this.trueskill.createRating(
              record.trueskillRating.mu, 
              record.trueskillRating.sigma
            );
          } else {
            // Handle legacy data without TrueSkill - initialize with default rating
            record.trueskillRating = this.trueskill.createRating();
            record.ratingHistory = [{ rating: record.trueskillRating, timestamp: 0 }];
          }
          
          if (record.ratingHistory && Array.isArray(record.ratingHistory)) {
            record.ratingHistory = record.ratingHistory.map((entry: any) => ({
              ...entry,
              rating: this.trueskill.createRating(entry.rating?.mu || 25, entry.rating?.sigma || 8.333)
            }));
          } else {
            // Initialize rating history if it doesn't exist
            record.ratingHistory = [{ rating: record.trueskillRating, timestamp: 0 }];
          }
          
          this.records.set(record.id, record);
        });
        
        console.log(`Loaded ${records.length} records and ${tournamentHistory.length} tournaments from storage`);
        
        // Migrate legacy data if needed
        this.migrateLegacyData();
        
      } catch (e) {
        console.error('Failed to parse stored records:', e);
      }
    } else {
      console.log('No stored records found - starting with empty rankings');
    }
  }

  private migrateLegacyData(): void {
    let needsMigration = false;
    
    // Check if any players lack proper TrueSkill data
    Array.from(this.records.values()).forEach(record => {
      if (!record.trueskillRating || 
          record.trueskillRating.mu === undefined || 
          record.trueskillRating.sigma === undefined ||
          !record.ratingHistory || 
          record.ratingHistory.length === 0 ||
          record.points === undefined) {
        needsMigration = true;
        
        // Fix the player record
        record.trueskillRating = this.trueskill.createRating();
        record.ratingHistory = [{ rating: record.trueskillRating, timestamp: 0 }];
        record.points = this.calculatePointsFromTrueSkill(record.trueskillRating);
        
        console.log(`Migrated TrueSkill data for player: ${record.tag}`);
      }
    });
    
    if (needsMigration) {
      console.log('Legacy data migration completed. Saving updated records...');
      this.saveToStorage();
    }
  }

  private saveToStorage(): void {
    const recordsArray = Array.from(this.records.values());
    
    // Convert tournament history Maps to plain objects for JSON serialization
    const tournamentHistoryForStorage = this.tournamentHistory.map(tournament => ({
      ...tournament,
      playerMap: Object.fromEntries(tournament.playerMap)
    }));
    
    const data = {
      records: recordsArray,
      tournamentHistory: tournamentHistoryForStorage
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  getHeadToHeadRecord(playerId: number, opponentId: number): {wins: number, losses: number} {
    const player = this.getRecord(playerId);
    if (!player || !player.headToHead[opponentId]) {
      return {wins: 0, losses: 0};
    }
    return player.headToHead[opponentId];
  }

  // Helper methods for working with TrueSkill ratings
  getTrueSkillDisplayRating(record: PlayerRecord): number {
    // Debug logging
    if (!record.trueskillRating || 
        record.trueskillRating.mu === undefined || 
        record.trueskillRating.sigma === undefined) {
      console.warn(`Player ${record.tag} has no TrueSkill rating! Initializing...`);
      record.trueskillRating = this.trueskill.createRating();
      record.ratingHistory = [{ rating: record.trueskillRating, timestamp: Date.now() }];
      this.saveToStorage(); // Save the fix
    }
    
    // Conservative estimate: μ - 3σ
    return Math.round(record.trueskillRating.mu - (3 * record.trueskillRating.sigma));
  }

  getTrueSkillMu(record: PlayerRecord): number {
    if (!record.trueskillRating || record.trueskillRating.mu === undefined) {
      record.trueskillRating = this.trueskill.createRating();
    }
    return Math.round(record.trueskillRating.mu * 100) / 100;
  }

  getTrueSkillSigma(record: PlayerRecord): number {
    if (!record.trueskillRating || record.trueskillRating.sigma === undefined) {
      record.trueskillRating = this.trueskill.createRating();
    }
    return Math.round(record.trueskillRating.sigma * 100) / 100;
  }

  getWinProbability(player1: PlayerRecord, player2: PlayerRecord): number {
    const quality = this.trueskill.quality([
      [player1.trueskillRating],
      [player2.trueskillRating]
    ]);
    return Math.round(quality * 10000) / 100; // Convert to percentage with 2 decimal places
  }

  // Helper method for getting display points (Braacket-style)
  getDisplayPoints(record: PlayerRecord): number {
    // Ensure points are calculated if missing
    if (record.points === undefined) {
      record.points = this.calculatePointsFromTrueSkill(record.trueskillRating);
    }
    return record.points;
  }

  // Method to reset season (resets all ratings and points)
  resetSeason(): void {
    console.log('Resetting season - clearing all ratings and points...');
    Array.from(this.records.values()).forEach(record => {
      record.trueskillRating = this.trueskill.createRating();
      record.ratingHistory = [{ rating: record.trueskillRating, timestamp: Date.now() }];
      record.points = this.calculatePointsFromTrueSkill(record.trueskillRating);
      // Keep wins, losses, appearances, and head-to-head data but reset ratings
    });
    this.tournamentHistory = [];
    this.saveToStorage();
    console.log('Season reset complete');
  }

  // Get tournament history for displaying results
  getTournamentHistory(): Array<{ sets: GgSet[]; playerMap: Map<number, number>; tournamentName?: string; timestamp: number }> {
    return this.tournamentHistory.slice().reverse(); // Return most recent first
  }

  /**
   * Groups sets by their tournament bracket rounds
   */
  private groupSetsByRounds(sets: GgSet[]): Map<string, GgSet[]> {
    const roundGroups = new Map<string, GgSet[]>();
    
    console.log('Grouping sets by rounds. Total sets:', sets.length);
    console.log('Sample set data:', sets.slice(0, 3));
    
    sets.forEach((set, index) => {
      let roundName = 'Other';
      
      console.log(`Set ${index + 1}:`, {
        id: set.id,
        round: set.round,
        identifier: set.identifier,
        fullRoundText: set.fullRoundText,
        winnerId: set.winnerId,
        entrantIds: set.entrantIds
      });
      
      // First try fullRoundText if available
      if (set.fullRoundText) {
        roundName = set.fullRoundText;
        console.log(`Using fullRoundText: ${roundName}`);
      }
      // Then try to map identifier to meaningful names
      else if (set.identifier) {
        roundName = this.mapIdentifierToRoundName(set.identifier);
        console.log(`Mapped identifier ${set.identifier} to: ${roundName}`);
      } 
      // Fallback to round number logic
      else if (set.round !== undefined) {
        // Positive rounds are winners bracket, negative are losers bracket
        if (set.round > 0) {
          if (set.round === 1) roundName = 'Grand Finals';
          else if (set.round === 2) roundName = 'Winners Finals';
          else if (set.round === 3) roundName = 'Winners Semis';
          else roundName = `Winners R${set.round}`;
        } else if (set.round < 0) {
          const absRound = Math.abs(set.round);
          if (absRound === 1) roundName = 'Losers Finals';
          else if (absRound === 2) roundName = 'Losers Semis';
          else roundName = `Losers R${absRound}`;
        }
        console.log(`Determined round from number ${set.round}: ${roundName}`);
      } else {
        console.log('No round information available, using "Other"');
      }
      
      if (!roundGroups.has(roundName)) {
        roundGroups.set(roundName, []);
      }
      roundGroups.get(roundName)!.push(set);
    });
    
    console.log('Final round groups:', Array.from(roundGroups.keys()));
    return roundGroups;
  }

  /**
   * Maps Start.gg bracket identifiers to human-readable round names
   */
  private mapIdentifierToRoundName(identifier: string): string {
    // Common Start.gg bracket position mappings
    // These vary by tournament format, but here are common patterns:
    
    // For double elimination brackets:
    const doubleElimMapping: { [key: string]: string } = {
      // Grand Finals area
      'GF': 'Grand Finals',
      'GFRESET': 'Grand Finals Reset',
      
      // Winners bracket
      'WF': 'Winners Finals',
      'WSF': 'Winners Semis',
      'WQF': 'Winners Quarters',
      
      // Losers bracket
      'LF': 'Losers Finals',
      'LSF': 'Losers Semis',
      'LQF': 'Losers Quarters',
      
      // Common alphabetical patterns (may vary by tournament)
      'AA': 'Grand Finals',
      'AB': 'Winners Finals',
      'AC': 'Losers Finals', 
      'AD': 'Winners Semis',
      'AE': 'Losers Semis',
      'AF': 'Winners Quarters',
      'AG': 'Losers Quarters',
    };
    
    // Check for exact matches first
    if (doubleElimMapping[identifier]) {
      return doubleElimMapping[identifier];
    }
    
    // For pool play or other formats, try to extract meaningful info
    if (identifier.includes('Pool')) {
      return identifier; // Keep pool names as-is
    }
    
    // For round robin or swiss, keep the identifier
    if (identifier.match(/^R\d+/)) {
      return `Round ${identifier.substring(1)}`;
    }
    
    // Try to parse patterns like "Winners Round 1", "Losers Round 2", etc.
    if (identifier.toLowerCase().includes('winners')) {
      return identifier;
    }
    if (identifier.toLowerCase().includes('losers')) {
      return identifier;
    }
    
    // For unknown patterns, try to make it more readable
    if (identifier.length <= 3 && identifier.match(/^[A-Z]+$/)) {
      // For short alphabetical codes, try to determine bracket position
      const charCode = identifier.charCodeAt(identifier.length - 1);
      const position = charCode - 65; // A=0, B=1, C=2, etc.
      
      if (position === 0) return 'Grand Finals';
      else if (position === 1) return 'Winners Finals';  
      else if (position === 2) return 'Losers Finals';
      else if (position === 3) return 'Winners Semis';
      else if (position === 4) return 'Losers Semis';
      else return `Bracket ${identifier}`;
    }
    
    // Default: return the identifier as-is but with better formatting
    return identifier.replace(/([A-Z])/g, ' $1').trim() || 'Unknown Round';
  }

  // Get recent tournament results formatted for display, grouped by rounds
  getRecentTournamentResults(limit: number = 50): Array<{
    tournamentName: string;
    date: Date;
    roundGroups: Array<{
      roundName: string;
      sets: Array<{
        player1: string;
        player2: string;
        winner: string;
        setId: string;
      }>;
    }>;
  }> {
    console.log('Getting recent tournament results...');
    console.log('Tournament history length:', this.tournamentHistory.length);
    console.log('Tournament history:', this.tournamentHistory);
    
    const results: Array<{
      tournamentName: string;
      date: Date;
      roundGroups: Array<{
        roundName: string;
        sets: Array<{
          player1: string;
          player2: string;
          winner: string;
          setId: string;
        }>;
      }>;
    }> = [];

    // Group sets by tournament
    const tournamentGroups = new Map<string, { sets: GgSet[], playerMap: Map<number, number>, timestamp: number }>();
    
    this.tournamentHistory.forEach(tournament => {
      const key = tournament.tournamentName || 'Unknown Tournament';
      if (!tournamentGroups.has(key)) {
        tournamentGroups.set(key, {
          sets: [],
          playerMap: tournament.playerMap,
          timestamp: tournament.timestamp
        });
      }
      tournamentGroups.get(key)!.sets.push(...tournament.sets);
    });

    // Convert to display format with round grouping
    Array.from(tournamentGroups.entries()).forEach(([tournamentName, data]) => {
      // Group sets by rounds
      const roundGroups = this.groupSetsByRounds(data.sets.slice(0, limit));
      
      // Helper function to get player name
      const getPlayerName = (originalId: number): string => {
        // First try to get mapped ID and find record
        const mappedId = data.playerMap.get(originalId);
        if (mappedId) {
          const record = this.records.get(mappedId);
          if (record?.tag) {
            return record.tag;
          }
        }
        
        // Fallback: search all records for one with matching original ID
        const directRecord = this.records.get(originalId);
        if (directRecord?.tag) {
          return directRecord.tag;
        }
        
        // Try to find by searching through all records for potential matches
        for (const [recordId, record] of this.records.entries()) {
          if (record.startggUserId === originalId) {
            return record.tag;
          }
        }
        
        // If no player record is found, return the ID as string
        return originalId.toString();
      };
      
      // Convert round groups to display format
      const roundGroupsDisplay = Array.from(roundGroups.entries()).map(([roundName, roundSets]) => {
        console.log(`Processing round: ${roundName} with ${roundSets.length} sets`);
        console.log('Sample set data:', roundSets[0]);
        
        const setsDisplay = roundSets.map(set => {
          const entrantIds = set.entrantIds || [];
          const entrantNames = set.entrantNames || [];
          const player1Id = entrantIds[0];
          const player2Id = entrantIds[1];
          
          // Use player names directly from start.gg if available and valid, otherwise fall back to ID resolution
          const isValidPlayerName = (name: string | undefined) => name && typeof name === 'string' && !/^\d+$/.test(name);
          
          const player1Name = isValidPlayerName(entrantNames[0]) ? entrantNames[0] : getPlayerName(player1Id);
          const player2Name = isValidPlayerName(entrantNames[1]) ? entrantNames[1] : getPlayerName(player2Id);
          
          // Determine winner name
          const winnerId = set.winnerId;
          const winnerIndex = entrantIds.indexOf(winnerId);
          const winnerEntrantName = winnerIndex >= 0 ? entrantNames[winnerIndex] : undefined;
          const winnerName = isValidPlayerName(winnerEntrantName) ? winnerEntrantName! : getPlayerName(winnerId);

          // Process games data if available
          const gamesData = set.games?.map(game => {
            // Get character selections for each player
            const player1Characters = game.selections
              ?.filter(s => s.entrantId === player1Id)
              ?.map(s => s.character?.name)
              ?.filter(name => name) || [];
            
            const player2Characters = game.selections
              ?.filter(s => s.entrantId === player2Id)
              ?.map(s => s.character?.name)
              ?.filter(name => name) || [];

            return {
              orderNum: game.orderNum,
              player1Score: game.entrant1Score,
              player2Score: game.entrant2Score,
              player1Characters,
              player2Characters
            };
          }) || [];

          return {
            player1: player1Name,
            player2: player2Name,
            winner: winnerName,
            setId: set.id,
            score: set.displayScore,
            totalGames: set.totalGames,
            vodUrl: set.vodUrl,
            completedAt: set.completedAt ? new Date(set.completedAt) : undefined,
            games: gamesData
          };
        });

        console.log('Sets display data sample:', setsDisplay.slice(0, 2));

        return {
          roundName,
          sets: setsDisplay
        };
      });

      // Sort round groups by importance (Grand Finals first, then Winners, then Losers)
      roundGroupsDisplay.sort((a, b) => {
        const order = ['Grand Finals', 'Winners Finals', 'Winners Semis', 'Losers Finals', 'Losers Semis'];
        const aIndex = order.findIndex(round => a.roundName.includes(round.split(' ')[0]));
        const bIndex = order.findIndex(round => b.roundName.includes(round.split(' ')[0]));
        
        if (aIndex === -1 && bIndex === -1) return a.roundName.localeCompare(b.roundName);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });

      results.push({
        tournamentName,
        date: new Date(data.timestamp),
        roundGroups: roundGroupsDisplay
      });
    });

    // Sort by date (most recent first) and limit results
    return results
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, Math.ceil(limit / 10)); // Limit number of tournaments
  }
}
