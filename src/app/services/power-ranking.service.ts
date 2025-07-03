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
 * - insertTestRecords() to reset to test data
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
        this.tournamentHistory = tournamentHistory;
        
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
    const data = {
      records: recordsArray,
      tournamentHistory: this.tournamentHistory
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
}
