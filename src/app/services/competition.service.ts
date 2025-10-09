import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { 
  CompetitionSeason, 
  House, 
  HouseAssignment, 
  CompetitionEvent, 
  PlayerCompetitionStats,
  SeasonRules,
  ImportedPlayer 
} from '../../models/competition';
import { PlayerRecord } from './power-ranking.service';

@Injectable({
  providedIn: 'root'
})
export class CompetitionService {
  private currentSeasonSubject = new BehaviorSubject<CompetitionSeason | null>(null);
  public currentSeason$ = this.currentSeasonSubject.asObservable();
  private readonly STORAGE_KEY = 'cape-competition-season';

  constructor() {
    // Load from localStorage first, then fallback to mock data
    this.loadFromStorage();
  }

  getCurrentSeason(): Observable<CompetitionSeason | null> {
    return this.currentSeason$;
  }

  getCurrentSeasonValue(): CompetitionSeason | null {
    return this.currentSeasonSubject.value;
  }

  updateSeason(season: CompetitionSeason): void {
    this.currentSeasonSubject.next(season);
    this.saveToStorage(season);
  }

  assignPlayerToHouse(playerId: number, playerName: string, houseId: number, isHighLevel: boolean): void {
    const currentSeason = this.getCurrentSeasonValue();
    if (!currentSeason) return;

    const assignment: HouseAssignment = {
      playerId,
      playerName,
      houseId,
      assignedDate: new Date(),
      isHighLevel
    };

    currentSeason.assignments.push(assignment);
    this.updateSeason(currentSeason);
  }

  removePlayerFromHouse(playerId: number): void {
    const currentSeason = this.getCurrentSeasonValue();
    if (!currentSeason) return;

    // Remove the house assignment
    const assignmentIndex = currentSeason.assignments.findIndex(a => a.playerId === playerId);
    if (assignmentIndex > -1) {
      currentSeason.assignments.splice(assignmentIndex, 1);
    }

    // Update imported player status if applicable
    const importedPlayer = currentSeason.importedPlayers.find(p => p.id === playerId);
    if (importedPlayer) {
      importedPlayer.isAssigned = false;
      importedPlayer.assignedHouseId = undefined;
    }

    this.updateSeason(currentSeason);
  }

  addCompetitionEvent(event: Omit<CompetitionEvent, 'id'>): void {
    const currentSeason = this.getCurrentSeasonValue();
    if (!currentSeason) return;

    const newEvent: CompetitionEvent = {
      ...event,
      id: currentSeason.events.length + 1
    };

    currentSeason.events.push(newEvent);
    
    // Update house points
    Object.entries(event.housePoints).forEach(([houseId, points]) => {
      const house = currentSeason.houses.find(h => h.id === parseInt(houseId));
      if (house) {
        house.points += points;
      }
    });

    this.updateSeason(currentSeason);
  }

  updateSeasonRules(rules: SeasonRules): void {
    const currentSeason = this.getCurrentSeasonValue();
    if (!currentSeason) return;

    currentSeason.rules = rules;
    this.updateSeason(currentSeason);
  }

  // Imported Players Management
  addOrUpdateImportedPlayers(players: PlayerRecord[], tournamentSlug: string): void {
    const currentSeason = this.getCurrentSeasonValue();
    if (!currentSeason) return;

    const now = new Date();
    let nextId = Math.max(0, ...currentSeason.importedPlayers.map(p => p.id)) + 1;

    players.forEach(playerRecord => {
      // Try to find existing player by startggUserId first, then by tag
      let existingPlayer = currentSeason.importedPlayers.find(
        p => p.startggUserId && playerRecord.startggUserId && p.startggUserId === playerRecord.startggUserId
      );
      
      if (!existingPlayer) {
        existingPlayer = currentSeason.importedPlayers.find(
          p => p.tag.toLowerCase() === playerRecord.tag.toLowerCase()
        );
      }

      if (existingPlayer) {
        // Update existing player
        existingPlayer.tag = playerRecord.tag; // Update tag in case it changed
        existingPlayer.lastSeen = now;
        if (!existingPlayer.tournaments.includes(tournamentSlug)) {
          existingPlayer.tournaments.push(tournamentSlug);
        }
        if (playerRecord.startggUserId && !existingPlayer.startggUserId) {
          existingPlayer.startggUserId = playerRecord.startggUserId;
        }
        // Update assignment status
        existingPlayer.isAssigned = currentSeason.assignments.some(a => a.playerId === existingPlayer!.id);
        existingPlayer.assignedHouseId = currentSeason.assignments.find(a => a.playerId === existingPlayer!.id)?.houseId;
      } else {
        // Create new imported player
        const newImportedPlayer: ImportedPlayer = {
          id: nextId++,
          tag: playerRecord.tag,
          startggUserId: playerRecord.startggUserId,
          tournaments: [tournamentSlug],
          firstImported: now,
          lastSeen: now,
          isAssigned: false,
          assignedHouseId: undefined
        };
        currentSeason.importedPlayers.push(newImportedPlayer);
      }
    });

    this.updateSeason(currentSeason);
  }

  getImportedPlayers(): ImportedPlayer[] {
    const currentSeason = this.getCurrentSeasonValue();
    return currentSeason?.importedPlayers || [];
  }

  getUnassignedImportedPlayers(): ImportedPlayer[] {
    return this.getImportedPlayers().filter(p => !p.isAssigned);
  }

  assignImportedPlayerToHouse(importedPlayerId: number, houseId: number, isHighLevel: boolean): void {
    console.log('Service: assignImportedPlayerToHouse called with:', { importedPlayerId, houseId, isHighLevel });
    
    const currentSeason = this.getCurrentSeasonValue();
    if (!currentSeason) {
      console.error('Service: No current season found');
      return;
    }

    const importedPlayer = currentSeason.importedPlayers.find(p => p.id === importedPlayerId);
    if (!importedPlayer) {
      console.error('Service: Imported player not found:', importedPlayerId);
      return;
    }

    console.log('Service: Found imported player:', importedPlayer.tag);

    // Create the house assignment
    this.assignPlayerToHouse(importedPlayer.id, importedPlayer.tag, houseId, isHighLevel);

    // Update the imported player status
    importedPlayer.isAssigned = true;
    importedPlayer.assignedHouseId = houseId;

    console.log('Service: Updated player assignment:', { isAssigned: importedPlayer.isAssigned, assignedHouseId: importedPlayer.assignedHouseId });

    this.updateSeason(currentSeason);
    console.log('Service: Season updated successfully');
  }

  /**
   * Remove a specific imported player
   */
  removeImportedPlayer(importedPlayerId: number): void {
    const currentSeason = this.getCurrentSeasonValue();
    if (!currentSeason) return;

    const playerIndex = currentSeason.importedPlayers.findIndex(p => p.id === importedPlayerId);
    if (playerIndex === -1) return;

    const player = currentSeason.importedPlayers[playerIndex];

    // If player is assigned to a house, remove the assignment first
    if (player.isAssigned) {
      const assignmentIndex = currentSeason.assignments.findIndex(a => a.playerId === importedPlayerId);
      if (assignmentIndex > -1) {
        currentSeason.assignments.splice(assignmentIndex, 1);
      }
    }

    // Remove the imported player
    currentSeason.importedPlayers.splice(playerIndex, 1);

    this.updateSeason(currentSeason);
  }

  /**
   * Clear all imported players
   */
  clearAllImportedPlayers(): void {
    const currentSeason = this.getCurrentSeasonValue();
    if (!currentSeason) return;

    // Remove all house assignments for imported players
    const importedPlayerIds = currentSeason.importedPlayers.map(p => p.id);
    currentSeason.assignments = currentSeason.assignments.filter(a => 
      !importedPlayerIds.includes(a.playerId)
    );

    // Clear all imported players
    currentSeason.importedPlayers = [];

    this.updateSeason(currentSeason);
  }

  getPlayerStats(): PlayerCompetitionStats[] {
    const currentSeason = this.getCurrentSeasonValue();
    if (!currentSeason) return [];

    const statsMap = new Map<number, PlayerCompetitionStats>();

    // Initialize stats for all assigned players
    currentSeason.assignments.forEach(assignment => {
      const house = currentSeason.houses.find(h => h.id === assignment.houseId);
      statsMap.set(assignment.playerId, {
        playerId: assignment.playerId,
        playerName: assignment.playerName,
        houseId: assignment.houseId,
        houseName: house?.name || '',
        totalPoints: 0,
        tournamentsWon: 0,
        upsetsScored: 0,
        grudgeMatchesWon: 0,
        eventsParticipated: 0
      });
    });

    // Calculate stats from events (this would be more complex in a real implementation)
    currentSeason.events.forEach(event => {
      if (event.isCompleted) {
        Object.entries(event.housePoints).forEach(([houseId, points]) => {
          // This is simplified - in reality you'd need more detailed event data
          // to properly attribute points to individual players
        });
      }
    });

    return Array.from(statsMap.values());
  }

  private initializeMockData(): void {
    const mockSeason: CompetitionSeason = {
      id: 1,
      name: 'Season 6 - Three Houses',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2025-12-31'),
      isActive: true,
      houses: [
        {
          id: 1,
          name: 'black_eagles',
          displayName: 'Black Eagles',
          color: '#DC143C',
          emblem: '🦅',
          leader: 'Edelgard',
          description: 'The noble house led by future Emperor Edelgard',
          points: 150
        },
        {
          id: 2,
          name: 'blue_lions',
          displayName: 'Blue Lions',
          color: '#4169E1',
          emblem: '🦁',
          leader: 'Dimitri',
          description: 'The chivalrous house led by the future King Dimitri',
          points: 125
        },
        {
          id: 3,
          name: 'golden_deer',
          displayName: 'Golden Deer',
          color: '#FFD700',
          emblem: '🦌',
          leader: 'Claude',
          description: 'The strategic house led by the cunning Claude',
          points: 175
        }
      ],
      events: [
        {
          id: 1,
          name: 'September Monthly',
          type: 'tournament',
          date: new Date('2025-09-15'),
          housePoints: { 1: 25, 2: 15, 3: 35 },
          description: 'First tournament of the season',
          isCompleted: true
        },
        {
          id: 2,
          name: 'Eagles vs Lions Rivalry',
          type: 'grudge_match',
          date: new Date('2025-09-22'),
          housePoints: { 1: 30, 2: 10, 3: 0 },
          description: 'Historic rivalry between the houses',
          isCompleted: false
        }
      ],
      assignments: [
        {
          playerId: 1,
          playerName: 'Player1',
          houseId: 1,
          assignedDate: new Date('2025-09-01'),
          isHighLevel: true
        },
        {
          playerId: 2,
          playerName: 'Player2',
          houseId: 2,
          assignedDate: new Date('2025-09-01'),
          isHighLevel: false
        }
      ],
      importedPlayers: [],
      rules: {
        upsetPointsFormula: 'base_points * (1 + opponent_rank_diff / 10)',
        winPointsFormula: 'base_points * placement_multiplier',
        grudgeMatchMultiplier: 1.5,
        specialEventMultiplier: 2.0
      }
    };

    this.updateSeason(mockSeason);
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const seasonData = JSON.parse(stored);
        // Convert date strings back to Date objects
        seasonData.startDate = new Date(seasonData.startDate);
        seasonData.endDate = new Date(seasonData.endDate);
        seasonData.assignments.forEach((assignment: any) => {
          assignment.assignedDate = new Date(assignment.assignedDate);
        });
        seasonData.events.forEach((event: any) => {
          event.date = new Date(event.date);
        });
        seasonData.importedPlayers.forEach((player: any) => {
          player.firstImported = new Date(player.firstImported);
          player.lastSeen = new Date(player.lastSeen);
        });
        
        this.currentSeasonSubject.next(seasonData);
        console.log('Loaded competition season from localStorage');
        return;
      }
    } catch (error) {
      console.warn('Failed to load competition season from localStorage:', error);
    }
    
    // Fallback to mock data if loading fails
    this.initializeMockData();
  }

  private saveToStorage(season: CompetitionSeason): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(season));
      console.log('Saved competition season to localStorage');
    } catch (error) {
      console.warn('Failed to save competition season to localStorage:', error);
    }
  }
}
