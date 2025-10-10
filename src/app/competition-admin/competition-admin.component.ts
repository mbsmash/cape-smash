import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { CompetitionService } from '../services/competition.service';
import { AuthService } from '../services/auth.service';
import { StartggService } from '../services/startgg.service';
import { PowerRankingService } from '../services/power-ranking.service';
import { TrueSkill } from 'ts-trueskill';
import { CompetitionSeason, House, CompetitionEvent, HouseAssignment, SeasonRules, ImportedPlayer } from '../../models/competition';
import { 
  ImportRequest, 
  ImportResult, 
  TournamentData, 
  SkillRating, 
  HeadToHeadRecord 
} from '../../models/startgg';

@Component({
  selector: 'app-competition-admin',
  templateUrl: './competition-admin.component.html',
  styleUrls: ['./competition-admin.component.css']
})
export class CompetitionAdminComponent implements OnInit, OnDestroy {
  currentSeason$: Observable<CompetitionSeason | null>;
  
  // Forms
  playerAssignmentForm: FormGroup;
  eventForm: FormGroup;
  tournamentEventForm: FormGroup;
  rulesForm: FormGroup;
  startggImportForm: FormGroup;
  
  // UI State
  activeTab = 'assignments';
  isImporting = false;
  selectedTournamentForViewing: string | null = null;
  
  // Player Filtering
  playerFilters = {
    minEvents: 0,
    maxEvents: null as number | null,
    showAssigned: true,
    showUnassigned: true
  };
  
  // Import Status
  importStatus: { type: 'success' | 'error' | 'warning', message: string, details?: string[] } | null = null;
  
  // Analytics Data
  recentImports: TournamentData[] = [];
  skillRatings: SkillRating[] = [];
  headToHeadMatrix: HeadToHeadRecord[] = [];
  filteredHeadToHead: HeadToHeadRecord[] = [];
  minH2HSets = 2;
  analyticsData: {
    totalPlayers: number;
    totalTournaments: number;
    totalSets: number;
    averageRating: number;
  } | null = null;
  
  houseBalanceRecommendation: {
    houses: Array<{
      emblem: string;
      name: string;
      averageRating: number;
      playerCount: number;
      highLevelCount: number;
      balanceScore: number;
      recommendations: string[];
    }>;
  } | null = null;
  
  // Rankings Data Management
  selectedRankingsTournament: string = '';
  manualTournamentSlug: string = '';
  rankingsImportStatus: 'success' | 'error' | 'warning' | null = null;
  rankingsImportMessage: string = '';
  rankingsImportDetails: string[] = [];
  rankingsTournaments: TournamentData[] = [];
  rankingsPlayersData: Map<string, {
    playerName: string;
    tournaments: number;
    placements: number[];
    matches: number;
    skillRating: number;
    confidence: number;
    displayRating: number;
    top25Count?: number; // Number of tournaments where player finished in top 25%
    consistencyRating?: number; // 0-100 rating based on performance consistency
    totalEntrants?: number[]; // Track tournament sizes for percentage calculations
  }> = new Map();

  // Previous Tournament Import Management
  selectedBaselineTournament: string = '';
  manualBaselineSlug: string = '';
  baselineImportOptions = {
    calculateSkillRatings: true,
    mergeWithExistingData: true,
    setAsBaseline: true
  };
  baselineImportPreview: {
    tournamentName: string;
    playerCount: number;
    eventCount: number;
    estimatedMatches: number;
    newPlayers: number;
    date: Date;
  } | null = null;
  
  constructor(
    private competitionService: CompetitionService,
    private authService: AuthService,
    private startggService: StartggService,
    private powerRankingService: PowerRankingService,
    private router: Router,
    private fb: FormBuilder
  ) {
    this.currentSeason$ = this.competitionService.getCurrentSeason();
    
    this.playerAssignmentForm = this.fb.group({
      importedPlayerId: ['', Validators.required],
      houseId: ['', Validators.required],
      isHighLevel: [false]
    });
    
    this.eventForm = this.fb.group({
      name: ['', Validators.required],
      type: ['tournament', Validators.required],
      date: ['', Validators.required],
      description: [''],
      housePoints: this.fb.group({
        1: [0, [Validators.required, Validators.min(0)]],
        2: [0, [Validators.required, Validators.min(0)]],
        3: [0, [Validators.required, Validators.min(0)]]
      }),
      isCompleted: [false]
    });

    this.tournamentEventForm = this.fb.group({
      tournamentSlug: ['', Validators.required],
      description: ['']
    });
    
    this.rulesForm = this.fb.group({
      upsetPointsFormula: ['', Validators.required],
      winPointsFormula: ['', Validators.required],
      grudgeMatchMultiplier: [1.5, [Validators.required, Validators.min(0)]],
      specialEventMultiplier: [2.0, [Validators.required, Validators.min(0)]]
    });

    this.startggImportForm = this.fb.group({
      tournamentSlug: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9\-_]+$/)]],
      importEvents: [true],
      calculateRatings: [true],
      mergeWithExisting: [true]
    });
  }

  ngOnInit(): void {
    this.loadCurrentRules();
    this.loadRecentImports();
    this.loadPersistedTournamentData();
  }

  // Tournament Data Persistence
  private readonly STORAGE_KEY_TOURNAMENTS = 'cape-smash-rankings-tournaments';
  private readonly STORAGE_KEY_PLAYERS_DATA = 'cape-smash-rankings-players';

  /**
   * Load persisted tournament data from localStorage
   */
  private loadPersistedTournamentData(): void {
    try {
      // Load tournaments
      const tournamentsJson = localStorage.getItem(this.STORAGE_KEY_TOURNAMENTS);
      if (tournamentsJson) {
        const tournaments = JSON.parse(tournamentsJson) as TournamentData[];
        this.rankingsTournaments = tournaments.map(t => ({
          ...t,
          importedAt: new Date(t.importedAt) // Convert back to Date object
        }));
        console.log(`📥 Loaded ${this.rankingsTournaments.length} persisted tournaments from localStorage`);
      }

      // Load player rankings data
      const playersJson = localStorage.getItem(this.STORAGE_KEY_PLAYERS_DATA);
      if (playersJson) {
        const playersArray = JSON.parse(playersJson);
        this.rankingsPlayersData = new Map(playersArray);
        console.log(`📥 Loaded ${this.rankingsPlayersData.size} persisted player records from localStorage`);
      }
    } catch (error) {
      console.error('❌ Error loading persisted tournament data:', error);
      // Reset to empty state if loading fails
      this.rankingsTournaments = [];
      this.rankingsPlayersData = new Map();
    }
  }

  /**
   * Save tournament data to localStorage
   */
  private savePersistedTournamentData(): void {
    try {
      // Save tournaments
      localStorage.setItem(this.STORAGE_KEY_TOURNAMENTS, JSON.stringify(this.rankingsTournaments));
      
      // Save player rankings data (convert Map to array for JSON serialization)
      const playersArray = Array.from(this.rankingsPlayersData.entries());
      localStorage.setItem(this.STORAGE_KEY_PLAYERS_DATA, JSON.stringify(playersArray));
      
      console.log(`💾 Saved ${this.rankingsTournaments.length} tournaments and ${this.rankingsPlayersData.size} player records to localStorage`);
    } catch (error) {
      console.error('❌ Error saving tournament data to localStorage:', error);
    }
  }

  /**
   * Clear all persisted data
   */
  private clearPersistedData(): void {
    localStorage.removeItem(this.STORAGE_KEY_TOURNAMENTS);
    localStorage.removeItem(this.STORAGE_KEY_PLAYERS_DATA);
    console.log('🗑️ Cleared all persisted tournament data');
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  loadCurrentRules(): void {
    const season = this.competitionService.getCurrentSeasonValue();
    if (season) {
      this.rulesForm.patchValue(season.rules);
    }
  }

  onAssignPlayer(): void {
    if (this.playerAssignmentForm.valid) {
      const formValue = this.playerAssignmentForm.value;
      
      // Debug logging
      console.log('Assigning player:', formValue);
      console.log('Available players:', this.getImportedPlayers());
      
      this.competitionService.assignImportedPlayerToHouse(
        parseInt(formValue.importedPlayerId), // Ensure it's a number
        parseInt(formValue.houseId), // Ensure it's a number
        formValue.isHighLevel
      );
      
      this.playerAssignmentForm.reset();
      
      // Force update of currentSeason$ observable
      this.currentSeason$ = this.competitionService.getCurrentSeason();
      
      alert('Player assigned successfully!');
    }
  }

  onAddEvent(): void {
    if (this.eventForm.valid) {
      const formValue = this.eventForm.value;
      this.competitionService.addCompetitionEvent({
        name: formValue.name,
        type: formValue.type,
        date: new Date(formValue.date),
        description: formValue.description,
        housePoints: formValue.housePoints,
        isCompleted: formValue.isCompleted
      });
      this.eventForm.reset();
      alert('Event added successfully!');
    }
  }

  onAddTournamentEvent(): void {
    if (this.tournamentEventForm.valid) {
      const formValue = this.tournamentEventForm.value;
      const selectedTournament = this.recentImports.find(t => t.tournament.slug === formValue.tournamentSlug);
      
      if (!selectedTournament) {
        alert('Selected tournament not found');
        return;
      }

      // Determine tournament date from the earliest event start time
      const earliestEvent = selectedTournament.events.reduce((earliest, event) => 
        event.startAt < earliest.startAt ? event : earliest
      );
      const tournamentDate = new Date(earliestEvent.startAt * 1000);

      // Tournament is completed if it was imported (data wouldn't exist if it wasn't)
      const isCompleted = true;

      // Initialize house points to 0 for all houses (will be calculated later)
      const season = this.competitionService.getCurrentSeasonValue();
      const housePoints: { [houseId: number]: number } = {};
      if (season) {
        season.houses.forEach(house => {
          housePoints[house.id] = 0;
        });
      }

      this.competitionService.addCompetitionEvent({
        name: selectedTournament.tournament.name,
        type: 'tournament',
        date: tournamentDate,
        description: formValue.description,
        housePoints: housePoints,
        isCompleted: isCompleted,
        tournamentSlug: formValue.tournamentSlug
      });
      
      this.tournamentEventForm.reset();
      alert('Tournament event added successfully!');
    }
  }

  onUpdateRules(): void {
    if (this.rulesForm.valid) {
      const formValue = this.rulesForm.value;
      this.competitionService.updateSeasonRules(formValue);
      alert('Rules updated successfully!');
    }
  }

  removeAssignment(assignment: HouseAssignment): void {
    const season = this.competitionService.getCurrentSeasonValue();
    if (season) {
      const index = season.assignments.findIndex(a => 
        a.playerId === assignment.playerId && a.houseId === assignment.houseId
      );
      if (index > -1) {
        season.assignments.splice(index, 1);
        
        // Update the imported player status
        const importedPlayer = season.importedPlayers.find(p => p.id === assignment.playerId);
        if (importedPlayer) {
          importedPlayer.isAssigned = false;
          importedPlayer.assignedHouseId = undefined;
        }
        
        this.competitionService.updateSeason(season);
        alert('Assignment removed successfully!');
      }
    }
  }

  removeEvent(event: CompetitionEvent): void {
    const season = this.competitionService.getCurrentSeasonValue();
    if (season) {
      const index = season.events.findIndex(e => e.id === event.id);
      if (index > -1) {
        season.events.splice(index, 1);
        this.competitionService.updateSeason(season);
        alert('Event removed successfully!');
      }
    }
  }

  getHouseName(houseId: number, houses: House[]): string {
    const house = houses.find(h => h.id === houseId);
    return house?.displayName || 'Unknown House';
  }

  ngOnDestroy(): void {
    // Automatically log out when leaving the admin component
    this.authService.logout();
  }

  getCurrentUser() {
    return this.authService.getCurrentUser();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/competition']);
  }

  goBackToCompetition(): void {
    this.logout(); // This will also log out the user
  }

  // ===== START.GG IMPORT METHODS =====

  loadRecentImports(): void {
    // Load recent imports from localStorage or service
    const stored = localStorage.getItem('cape-recent-imports');
    if (stored) {
      try {
        this.recentImports = JSON.parse(stored);
      } catch (error) {
        console.warn('Failed to load recent imports:', error);
        this.recentImports = [];
      }
    }
  }

  onImportTournament(): void {
    if (!this.startggImportForm.valid || this.isImporting) return;

    this.isImporting = true;
    this.importStatus = null;

    const formValue = this.startggImportForm.value;
    const tournamentUrl = `https://start.gg/tournament/${formValue.tournamentSlug}`;
    
    const request: ImportRequest = {
      tournamentUrl: tournamentUrl,
      importEvents: formValue.importEvents,
      calculateRatings: formValue.calculateRatings,
      mergeWithExisting: formValue.mergeWithExisting
    };

    this.startggService.importTournament(request).subscribe({
      next: (result: ImportResult) => {
        this.handleImportResult(result);
      },
      error: (error: any) => {
        console.error('Import failed:', error);
        this.importStatus = {
          type: 'error',
          message: 'Failed to import tournament',
          details: [error.message || 'Unknown error occurred']
        };
        this.isImporting = false;
      }
    });
  }

  handleImportResult(result: ImportResult): void {
    this.isImporting = false;

    if (result.success && result.data) {
      this.importStatus = {
        type: 'success',
        message: result.message,
        details: result.warnings
      };

      // Add to recent imports
      this.recentImports.unshift(result.data);
      if (this.recentImports.length > 10) {
        this.recentImports = this.recentImports.slice(0, 10);
      }
      this.saveRecentImports();

      // Update analytics data
      this.updateAnalyticsData(result.data);

      // Sync real imported players with competition system (only if player data exists)
      if (result.data.players && result.data.players.length > 0) {
        this.syncRealPlayersWithCompetition(result.data.tournament.slug, result.data.players);
      }

      // Reset form
      this.startggImportForm.patchValue({ tournamentSlug: '' });

      // Auto-switch to analytics tab
      this.setActiveTab('analytics');
    } else {
      this.importStatus = {
        type: 'error',
        message: result.message,
        details: result.errors
      };
    }
  }

  loadMockData(): void {
    this.isImporting = true;
    this.importStatus = null;

    this.startggService.getMockTournamentData().subscribe({
      next: (result: ImportResult) => {
        this.handleImportResult(result);
      },
      error: (error: any) => {
        console.error('Mock data failed:', error);
        this.importStatus = {
          type: 'error',
          message: 'Failed to load mock data',
          details: [error.message || 'Unknown error occurred']
        };
        this.isImporting = false;
      }
    });
  }

  getImportedPlayers(): ImportedPlayer[] {
    return this.getFilteredImportedPlayers();
  }

  getFilteredImportedPlayers(): ImportedPlayer[] {
    const allPlayers = this.competitionService.getImportedPlayers();
    
    return allPlayers.filter(player => {
      // Filter by number of events attended
      const eventCount = player.tournaments.length;
      if (eventCount < this.playerFilters.minEvents) return false;
      if (this.playerFilters.maxEvents !== null && eventCount > this.playerFilters.maxEvents) return false;
      
      // Filter by assignment status
      if (player.isAssigned && !this.playerFilters.showAssigned) return false;
      if (!player.isAssigned && !this.playerFilters.showUnassigned) return false;
      
      return true;
    });
  }

  getAllImportedPlayers(): ImportedPlayer[] {
    return this.competitionService.getImportedPlayers();
  }

  getMaxEventCount(): number {
    const allPlayers = this.competitionService.getImportedPlayers();
    if (allPlayers.length === 0) return 0;
    return Math.max(...allPlayers.map(p => p.tournaments.length));
  }

  resetPlayerFilters(): void {
    this.playerFilters = {
      minEvents: 0,
      maxEvents: null,
      showAssigned: true,
      showUnassigned: true
    };
  }

  hasActiveFilters(): boolean {
    return this.playerFilters.minEvents > 0 || 
           this.playerFilters.maxEvents !== null || 
           !this.playerFilters.showAssigned || 
           !this.playerFilters.showUnassigned;
  }

  /**
   * Sync real players from tournament data with competition system
   */
  syncRealPlayersWithCompetition(tournamentSlug: string, players: any[]): void {
    if (!players || players.length === 0) return;

    // Create TrueSkill instance for proper rating initialization
    const trueskill = new TrueSkill();

    // Convert real PlayerPerformance data to PlayerRecord format for the competition service
    const playerRecords = players.map(player => ({
      id: player.id,
      tag: player.tag,
      wins: player.overallStats?.setsWon || 0,
      losses: player.overallStats?.setsLost || 0,
      appearances: 1,
      headToHead: {},
      startggUserId: player.userId,
      trueskillRating: trueskill.createRating(), // Create proper TrueSkill rating
      ratingHistory: [],
      points: player.skillRating || 1000
    }));
    
    // Add these real players to the competition system
    this.competitionService.addOrUpdateImportedPlayers(playerRecords, tournamentSlug);
    console.log(`Synced ${playerRecords.length} REAL players from tournament: ${tournamentSlug}`);
  }

  getUnassignedImportedPlayers(): ImportedPlayer[] {
    return this.getFilteredImportedPlayers().filter(p => !p.isAssigned);
  }

  saveRecentImports(): void {
    try {
      localStorage.setItem('cape-recent-imports', JSON.stringify(this.recentImports));
    } catch (error) {
      console.warn('Failed to save recent imports:', error);
    }
  }

  updateAnalyticsData(data: TournamentData): void {
    this.skillRatings = data.skillRatings;
    this.headToHeadMatrix = data.headToHeadMatrix;
    this.filteredHeadToHead = this.headToHeadMatrix.filter(h2h => h2h.totalSets >= this.minH2HSets);

    // Calculate summary analytics
    this.analyticsData = {
      totalPlayers: data.playerCount,
      totalTournaments: this.recentImports.length,
      totalSets: data.events.reduce((sum, event) => sum + event.sets.length, 0),
      averageRating: data.skillRatings.length > 0 
        ? data.skillRatings.reduce((sum, rating) => sum + rating.rating, 0) / data.skillRatings.length 
        : 0
    };

    // Generate house balance recommendations
    this.generateHouseBalanceRecommendations();
  }

  generateHouseBalanceRecommendations(): void {
    const season = this.competitionService.getCurrentSeasonValue();
    if (!season || this.skillRatings.length === 0) {
      this.houseBalanceRecommendation = null;
      return;
    }

    const houses = season.houses.map(house => {
      const assignedPlayers = season.assignments.filter(a => a.houseId === house.id);
      const playerRatings = assignedPlayers
        .map(assignment => {
          const rating = this.skillRatings.find(r => r.playerTag === assignment.playerName);
          return rating ? rating.rating : 1000; // Default rating
        });

      const averageRating = playerRatings.length > 0 
        ? playerRatings.reduce((sum, rating) => sum + rating, 0) / playerRatings.length 
        : 1000;

      const highLevelCount = assignedPlayers.filter(a => a.isHighLevel).length;
      
      // Simple balance score based on how close to average the house is
      const globalAverage = this.analyticsData?.averageRating || 1000;
      const balanceScore = 1 - Math.abs(averageRating - globalAverage) / globalAverage;

      const recommendations: string[] = [];
      if (playerRatings.length < 5) {
        recommendations.push('Consider adding more players to this house');
      }
      if (averageRating > globalAverage + 100) {
        recommendations.push('House may be too strong - consider balancing with lower-rated players');
      }
      if (averageRating < globalAverage - 100) {
        recommendations.push('House may need stronger players for better balance');
      }
      if (highLevelCount === 0 && playerRatings.length > 3) {
        recommendations.push('Consider marking some high-performing players as high-level');
      }

      return {
        emblem: house.emblem,
        name: house.displayName,
        averageRating,
        playerCount: assignedPlayers.length,
        highLevelCount,
        balanceScore: Math.max(0, balanceScore),
        recommendations
      };
    });

    this.houseBalanceRecommendation = { houses };
  }

  // ===== ANALYTICS METHODS =====

  filterHeadToHead(): void {
    this.filteredHeadToHead = this.headToHeadMatrix.filter(h2h => h2h.totalSets >= this.minH2HSets);
  }

  getTrendIcon(trend: string): string {
    switch (trend) {
      case 'improving': return '↗️';
      case 'declining': return '↘️';
      default: return '➡️';
    }
  }

  getPlayerHouseAssignment(playerTag: string): string | null {
    const season = this.competitionService.getCurrentSeasonValue();
    if (!season) return null;

    const assignment = season.assignments.find(a => a.playerName === playerTag);
    if (!assignment) return null;

    const house = season.houses.find(h => h.id === assignment.houseId);
    return house ? `${house.emblem} ${house.displayName}` : null;
  }

  assignPlayerFromRating(rating: SkillRating): void {
    // Pre-fill the player assignment form with rating data
    this.playerAssignmentForm.patchValue({
      playerId: rating.playerId,
      playerName: rating.playerTag,
      isHighLevel: rating.rating > 1200 // Consider high-rated players as high-level
    });

    // Switch to assignments tab
    this.setActiveTab('assignments');
  }

  getH2HWinRate(h2h: HeadToHeadRecord): number {
    return (h2h.player1Wins / h2h.totalSets) * 100;
  }

  viewImportDetails(importData: TournamentData): void {
    // Show detailed modal or expand section
    alert(`Tournament: ${importData.tournament.name}\nPlayers: ${importData.playerCount}\nEvents: ${importData.eventCount}\nImported: ${importData.importedAt}`);
  }

  removeImport(importData: TournamentData): void {
    const index = this.recentImports.indexOf(importData);
    if (index > -1) {
      this.recentImports.splice(index, 1);
      this.saveRecentImports();

      // Recalculate analytics if this was the current data source
      if (this.recentImports.length > 0) {
        this.updateAnalyticsData(this.recentImports[0]);
      } else {
        this.analyticsData = null;
        this.skillRatings = [];
        this.headToHeadMatrix = [];
        this.filteredHeadToHead = [];
        this.houseBalanceRecommendation = null;
      }
    }
  }

  viewPlayerDetails(rating: SkillRating): void {
    // Show detailed player modal
    const h2hRecords = this.headToHeadMatrix.filter(h2h => 
      h2h.player1Tag === rating.playerTag || h2h.player2Tag === rating.playerTag
    );
    
    let details = `Player: ${rating.playerTag}\n`;
    details += `Rating: ${rating.rating}\n`;
    details += `Confidence: ${(rating.confidence * 100).toFixed(1)}%\n`;
    details += `Recent Form: ${rating.recentForm}\n`;
    details += `Head-to-Head Records: ${h2hRecords.length}`;
    
    alert(details);
  }

  viewH2HDetails(h2h: HeadToHeadRecord): void {
    let details = `${h2h.player1Tag} vs ${h2h.player2Tag}\n`;
    details += `Record: ${h2h.player1Wins}-${h2h.player2Wins}\n`;
    details += `Total Sets: ${h2h.totalSets}\n`;
    details += `Win Rate: ${this.getH2HWinRate(h2h).toFixed(1)}%\n`;
    if (h2h.lastSetDate) {
      details += `Last Meeting: ${h2h.lastSetDate.toDateString()}`;
    }
    
    alert(details);
  }

  /**
   * Save recent imports to localStorage
   */
  private saveImportsToStorage(): void {
    try {
      const importsData = this.recentImports.map(imp => ({
        ...imp,
        importedAt: imp.importedAt.toISOString()
      }));
      localStorage.setItem('cape-smash-tournament-imports', JSON.stringify(importsData));
    } catch (error) {
      console.error('Failed to save imports to storage:', error);
    }
  }

  /**
   * Load recent imports from localStorage
   */
  private loadImportsFromStorage(): void {
    try {
      const stored = localStorage.getItem('cape-smash-tournament-imports');
      if (stored) {
        const importsData = JSON.parse(stored);
        this.recentImports = importsData.map((imp: any) => ({
          ...imp,
          importedAt: new Date(imp.importedAt)
        }));
      }
    } catch (error) {
      console.error('Failed to load imports from storage:', error);
      this.recentImports = [];
    }
  }

  /**
   * Update import status message
   */
  private updateImportStatus(type: 'warning' | 'success' | 'error', message: string, details?: string[]): void {
    this.importStatus = {
      type,
      message,
      details
    };

    // Auto-clear success/warning messages after 5 seconds
    if (type !== 'error') {
      setTimeout(() => {
        this.importStatus = null;
      }, 5000);
    }
  }

  getCompletedEventsCount(): number {
    const season = this.competitionService.getCurrentSeasonValue();
    return season ? season.events.filter(e => e.isCompleted).length : 0;
  }

  getUpcomingEventsCount(): number {
    const season = this.competitionService.getCurrentSeasonValue();
    return season ? season.events.filter(e => !e.isCompleted).length : 0;
  }

  editEvent(event: CompetitionEvent): void {
    // For now, just show an alert. This could be expanded to open an edit form
    alert('Edit functionality coming soon!');
  }

  /**
   * View imported players from a specific tournament
   */
  viewTournamentPlayers(tournamentSlug: string): void {
    const tournamentData = this.recentImports.find(imp => imp.tournament.slug === tournamentSlug);
    if (!tournamentData) {
      alert('Tournament data not found!');
      return;
    }

    // Switch to Player Assignments tab and filter/highlight players from this tournament
    this.setActiveTab('assignments');
    
    // Set a property to track which tournament is being viewed
    this.selectedTournamentForViewing = tournamentSlug;
    
    // Scroll to imported players section
    setTimeout(() => {
      const importedSection = document.querySelector('.imported-players-section');
      if (importedSection) {
        importedSection.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }

  /**
   * Get tournament name for display
   */
  getTournamentName(tournamentSlug: string): string {
    const tournament = this.recentImports.find(imp => imp.tournament.slug === tournamentSlug);
    return tournament ? tournament.tournament.name : tournamentSlug;
  }

  /**
   * Check if a player is from the currently selected tournament
   */
  isPlayerFromSelectedTournament(player: ImportedPlayer): boolean {
    return this.selectedTournamentForViewing ? 
      player.tournaments.includes(this.selectedTournamentForViewing) : 
      false;
  }

  /**
   * Remove an individual imported player
   */
  removeImportedPlayer(player: ImportedPlayer): void {
    if (confirm(`Are you sure you want to remove ${player.tag} from imported players? This will also remove any house assignment.`)) {
      this.competitionService.removeImportedPlayer(player.id);
    }
  }

  /**
   * Clear all imported players
   */
  clearAllImportedPlayers(): void {
    if (confirm('Are you sure you want to clear ALL imported players? This will remove all players and their house assignments.')) {
      this.competitionService.clearAllImportedPlayers();
      this.selectedTournamentForViewing = null; // Clear any tournament filter
    }
  }

  // ===== HOUSE MANAGEMENT METHODS =====

  /**
   * Get the number of players assigned to a house
   */
  getHousePlayerCount(houseId: number): number {
    const season = this.competitionService.getCurrentSeasonValue();
    if (!season) return 0;
    
    return season.importedPlayers.filter(player => 
      player.isAssigned && player.assignedHouseId === houseId
    ).length;
  }

  /**
   * Get the average skill rating for players in a house
   */
  getHouseAverageRating(houseId: number): number {
    const housePlayers = this.getHousePlayers(houseId);
    if (housePlayers.length === 0) return 0;
    
    const totalRating = housePlayers.reduce((sum, player) => sum + this.getPlayerRating(player), 0);
    return totalRating / housePlayers.length;
  }

  /**
   * Get all players assigned to a specific house
   */
  getHousePlayers(houseId: number): ImportedPlayer[] {
    const season = this.competitionService.getCurrentSeasonValue();
    if (!season) return [];
    
    return season.importedPlayers.filter(player => 
      player.isAssigned && player.assignedHouseId === houseId
    );
  }

  /**
   * Get all unassigned players
   */
  getUnassignedPlayers(): ImportedPlayer[] {
    const season = this.competitionService.getCurrentSeasonValue();
    if (!season) return [];
    
    return season.importedPlayers.filter(player => !player.isAssigned);
  }

  /**
   * Get a player's skill rating from the PowerRankingService
   */
  getPlayerRating(player: ImportedPlayer): number {
    // Try to find the player in PowerRankingService records
    const powerRankingRecord = this.powerRankingService.getRecords().find(record => 
      record.tag === player.tag || record.startggUserId === player.startggUserId
    );
    
    if (powerRankingRecord) {
      return this.powerRankingService.getTrueSkillDisplayRating(powerRankingRecord);
    }
    
    // Default rating if not found (equivalent to new player)
    return 0; // Conservative TrueSkill estimate for new player (25 - 3*8.333 ≈ 0)
  }

  /**
   * Assign a player to a house
   */
  assignPlayerToHouse(playerId: number, houseId: number | string): void {
    // Convert houseId to number if it's a string (from HTML select)
    const numericHouseId = typeof houseId === 'string' ? parseInt(houseId, 10) : houseId;
    
    if (!numericHouseId || isNaN(numericHouseId)) {
      alert('Please select a house');
      return;
    }

    this.competitionService.assignImportedPlayerToHouse(playerId, numericHouseId, false);
    
    // Clear the temporary house selection
    const season = this.competitionService.getCurrentSeasonValue();
    if (season) {
      const player = season.importedPlayers.find(p => p.id === playerId);
      if (player) {
        player.tempHouseId = undefined;
      }
    }
  }

  /**
   * Remove a player from their house assignment
   */
  removePlayerFromHouse(playerId: number): void {
    const season = this.competitionService.getCurrentSeasonValue();
    if (!season) return;
    
    const player = season.importedPlayers.find(p => p.id === playerId);
    if (!player) return;
    
    if (confirm(`Remove ${player.tag} from their house assignment?`)) {
      this.competitionService.removePlayerFromHouse(playerId);
    }
  }

  /**
   * View detailed imported player information (placeholder for future implementation)
   */
  viewImportedPlayerDetails(player: ImportedPlayer): void {
    // Could open a modal or navigate to a detailed view
    alert(`Player Details for ${player.tag}:\n\n` +
          `Rating: ${this.getPlayerRating(player)}\n` +
          `Tournaments: ${player.tournaments.length}\n` +
          `First Imported: ${player.firstImported.toLocaleDateString()}\n` +
          `Last Seen: ${player.lastSeen.toLocaleDateString()}`);
  }

  /**
   * Auto-balance houses using advanced skill metrics from rankings data
   */
  autoBalanceHouses(): void {
    const season = this.competitionService.getCurrentSeasonValue();
    if (!season) return;
    
    const unassignedPlayers = this.getUnassignedPlayers();
    if (unassignedPlayers.length === 0) {
      alert('No unassigned players to balance');
      return;
    }
    
    const hasRankingsData = this.rankingsPlayersData.size > 0;
    const balanceMessage = hasRankingsData 
      ? `Auto-balance ${unassignedPlayers.length} unassigned players using previous season skill data?`
      : `Auto-balance ${unassignedPlayers.length} unassigned players using basic ratings?`;
    
    if (!confirm(balanceMessage)) {
      return;
    }
    
    // Enhanced player rating calculation using rankings data
    const getEnhancedPlayerRating = (player: ImportedPlayer): number => {
      const baseRating = this.getPlayerRating(player);
      
      if (hasRankingsData) {
        // Look for player in rankings data
        const rankingsData = this.rankingsPlayersData.get(player.tag);
        if (rankingsData) {
          // Blend rankings data with current rating
          const confidence = rankingsData.confidence;
          const rankingsRating = rankingsData.displayRating;
          
          // Weight the blend based on confidence in historical data
          return (baseRating * (1 - confidence * 0.7)) + (rankingsRating * (confidence * 0.7));
        }
      }
      
      return baseRating;
    };
    
    // Sort players by enhanced skill rating (highest first)
    const sortedPlayers = unassignedPlayers.sort((a, b) => 
      getEnhancedPlayerRating(b) - getEnhancedPlayerRating(a)
    );
    
    // Calculate enhanced house balance metrics
    const getEnhancedHouseMetrics = (houseId: number) => {
      const housePlayers = this.getHousePlayers(houseId);
      const ratings = housePlayers.map(p => getEnhancedPlayerRating(p));
      
      return {
        houseId,
        playerCount: housePlayers.length,
        totalRating: ratings.reduce((sum, rating) => sum + rating, 0),
        averageRating: ratings.length > 0 ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0,
        ratingVariance: this.calculateVariance(ratings),
        highSkillCount: ratings.filter(r => r > 30).length
      };
    };
    
    // Distribute players with advanced balancing algorithm
    sortedPlayers.forEach((player, index) => {
      const playerRating = getEnhancedPlayerRating(player);
      const isHighSkill = playerRating > 30;
      
      const houseMetrics = season.houses.map(house => getEnhancedHouseMetrics(house.id));
      
      // Calculate balance score for each house if this player were added
      const houseScores = houseMetrics.map(metrics => {
        const newPlayerCount = metrics.playerCount + 1;
        const newTotalRating = metrics.totalRating + playerRating;
        const newAverageRating = newTotalRating / newPlayerCount;
        const newHighSkillCount = metrics.highSkillCount + (isHighSkill ? 1 : 0);
        
        // Balance factors (lower is better)
        const playerCountImbalance = Math.abs(newPlayerCount - (unassignedPlayers.length + this.getAssignedPlayerCount()) / season.houses.length);
        const ratingImbalance = Math.abs(newAverageRating - 25); // Target rating around 25
        const highSkillImbalance = Math.abs(newHighSkillCount - (this.getHighSkillPlayerCount() / season.houses.length));
        
        return {
          houseId: metrics.houseId,
          balanceScore: playerCountImbalance + (ratingImbalance * 0.5) + (highSkillImbalance * 2),
          newAverageRating,
          newPlayerCount,
          newHighSkillCount
        };
      });
      
      // Sort by balance score (lowest is best fit)
      houseScores.sort((a, b) => a.balanceScore - b.balanceScore);
      
      const targetHouse = houseScores[0];
      this.competitionService.assignImportedPlayerToHouse(player.id, targetHouse.houseId, isHighSkill);
    });
    
    const statusMessage = hasRankingsData 
      ? `Successfully balanced ${unassignedPlayers.length} players using previous season data!`
      : `Successfully balanced ${unassignedPlayers.length} players using basic ratings!`;
    
    alert(statusMessage);
  }

  /**
   * Calculate variance of a set of ratings
   */
  private calculateVariance(ratings: number[]): number {
    if (ratings.length === 0) return 0;
    
    const mean = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    const squaredDiffs = ratings.map(rating => Math.pow(rating - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / ratings.length;
  }

  /**
   * Get total count of assigned players
   */
  private getAssignedPlayerCount(): number {
    const season = this.competitionService.getCurrentSeasonValue();
    if (!season) return 0;
    return season.importedPlayers.filter(p => p.isAssigned).length;
  }

  /**
   * Get total count of high skill players
   */
  private getHighSkillPlayerCount(): number {
    const season = this.competitionService.getCurrentSeasonValue();
    if (!season) return 0;
    return season.importedPlayers.filter(p => this.getPlayerRating(p) > 30).length;
  }

  /**
   * Shuffle the order of unassigned players
   */
  shuffleUnassigned(): void {
    const season = this.competitionService.getCurrentSeasonValue();
    if (!season) return;
    
    const unassignedPlayers = this.getUnassignedPlayers();
    if (unassignedPlayers.length === 0) {
      alert('No unassigned players to shuffle');
      return;
    }
    
    // Fisher-Yates shuffle algorithm
    for (let i = unassignedPlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unassignedPlayers[i], unassignedPlayers[j]] = [unassignedPlayers[j], unassignedPlayers[i]];
    }
    
    // Update the order in the season data
    const shuffledIndices = unassignedPlayers.map(player => 
      season.importedPlayers.findIndex(p => p.id === player.id)
    );
    
    // Reorder the unassigned players in the array
    shuffledIndices.forEach((originalIndex, newPosition) => {
      if (originalIndex !== -1) {
        season.importedPlayers[originalIndex] = unassignedPlayers[newPosition];
      }
    });
    
    this.competitionService.updateSeason(season);
    alert('Unassigned players have been shuffled!');
  }

  /**
   * Clear all house assignments
   */
  clearAllAssignments(): void {
    const season = this.competitionService.getCurrentSeasonValue();
    if (!season) return;
    
    const assignedCount = season.importedPlayers.filter(p => p.isAssigned).length;
    if (assignedCount === 0) {
      alert('No players are currently assigned to houses');
      return;
    }
    
    if (!confirm(`Remove all house assignments? This will unassign ${assignedCount} players.`)) {
      return;
    }
    
    season.importedPlayers.forEach(player => {
      if (player.isAssigned) {
        player.isAssigned = false;
        player.assignedHouseId = undefined;
      }
    });
    
    // Also clear traditional assignments
    season.assignments = [];
    
    this.competitionService.updateSeason(season);
    alert(`Cleared all house assignments for ${assignedCount} players!`);
  }

  // ===== RANKINGS DATA MANAGEMENT METHODS =====

  /**
   * Get available tournaments for rankings import
   */
  getAvailableTournaments(): TournamentData[] {
    return this.recentImports.filter(tournament => 
      !this.rankingsTournaments.some(rt => rt.tournament.slug === tournament.tournament.slug)
    );
  }

  /**
   * Handle tournament selection change
   */
  onRankingsTournamentSelect(): void {
    if (this.selectedRankingsTournament) {
      this.manualTournamentSlug = '';
    }
  }

  /**
   * Import tournament data for rankings calculation
   */
  importRankingsData(): void {
    const tournamentSlug = this.selectedRankingsTournament || this.manualTournamentSlug;
    
    if (!tournamentSlug.trim()) {
      this.setRankingsImportStatus('error', 'Please select a tournament or enter a slug');
      return;
    }

    // First try to find in existing imports
    let tournamentData = this.recentImports.find(t => t.tournament.slug === tournamentSlug);
    
    if (!tournamentData) {
      // Import new tournament data
      this.setRankingsImportStatus('warning', 'Importing tournament data...', [
        'Fetching tournament information',
        'Loading player data and placements',
        'Calculating head-to-head records'
      ]);

      const importRequest: ImportRequest = {
        tournamentUrl: `https://start.gg/${tournamentSlug}`,
        importEvents: true,
        calculateRatings: true,
        mergeWithExisting: false
      };

      this.startggService.importTournament(importRequest).subscribe({
        next: (importResult) => {
          if (!importResult.success || !importResult.data) {
            this.setRankingsImportStatus('error', importResult.message, importResult.errors);
            return;
          }

          const newTournamentData = importResult.data;
          this.recentImports.push(newTournamentData);
          this.processRankingsImport(newTournamentData);
        },
        error: (error) => {
          console.error('Error importing rankings data:', error);
          this.setRankingsImportStatus('error', 'Failed to import tournament data', [
            error instanceof Error ? error.message : 'Unknown error occurred'
          ]);
        }
      });
    } else {
      this.processRankingsImport(tournamentData);
    }
  }

  /**
   * Process imported tournament data for rankings
   */
  private processRankingsImport(tournamentData: TournamentData): void {
    // Check if already imported for rankings
    if (this.rankingsTournaments.some(rt => rt.tournament.slug === tournamentData.tournament.slug)) {
      this.setRankingsImportStatus('warning', 'Tournament already imported for rankings');
      return;
    }

    // Add to rankings data
    this.rankingsTournaments.push(tournamentData);
    this.updateRankingsPlayerData(tournamentData);
    this.recalculateRankings();
    
    // Save to localStorage
    this.savePersistedTournamentData();

    this.setRankingsImportStatus('success', 'Tournament imported successfully!', [
      `${tournamentData.playerCount} players added`,
      `${tournamentData.events.length} events imported`,
      'Performance rankings updated',
      'Data saved locally'
    ]);

    // Clear form
    this.selectedRankingsTournament = '';
    this.manualTournamentSlug = '';
  }

  /**
   * Clear all rankings data
   */
  clearAllRankingsData(): void {
    if (!confirm('Clear all rankings training data? This cannot be undone.')) {
      return;
    }

    this.rankingsTournaments = [];
    this.rankingsPlayersData.clear();
    
    // Clear persisted data
    this.clearPersistedData();
    
    this.setRankingsImportStatus('success', 'All rankings data cleared');
  }

  /**
   * Get imported tournaments for rankings
   */
  getRankingsTournaments(): Array<{
    slug: string;
    name: string;
    startAt: Date;
    numEntrants: number;
    matches?: any[];
    events?: any[]; // Add events to the transformed object
    topPlacements?: Array<{playerName: string}>;
  }> {
    return this.rankingsTournaments.map(tournament => ({
      slug: tournament.tournament.slug,
      name: tournament.tournament.name,
      startAt: new Date(tournament.importedAt),
      numEntrants: tournament.playerCount,
      matches: tournament.headToHeadMatrix,
      events: tournament.events, // Include the events with sets data
      topPlacements: tournament.events[0]?.placement?.slice(0, 3).map(p => ({
        playerName: p.playerTag
      })) || []
    }));
  }

  /**
   * Get unique players from rankings data
   */
  getRankingsPlayers(): string[] {
    return Array.from(this.rankingsPlayersData.keys());
  }

  /**
   * Get total number of unique players across all tournaments
   */
  getTotalRankingsPlayers(): number {
    return this.rankingsPlayersData.size;
  }

  /**
   * Get total number of matches across all tournaments
   */
  getTotalMatches(): number {
    console.log('🎯 Getting total matches across all tournaments:', this.rankingsTournaments);
    const total = this.rankingsTournaments.reduce((total, tournamentData) => {
      // Count all sets from all events in each tournament
      const tournamentSets = tournamentData.events?.reduce((eventTotal, event) => 
        eventTotal + (event.sets?.length || 0), 0) || 0;
      console.log(`📊 Tournament ${tournamentData.tournament?.name || 'Unknown'} contributes ${tournamentSets} matches`);
      return total + tournamentSets;
    }, 0);
    console.log(`🎉 Total matches across all tournaments: ${total}`);
    return total;
  }

  /**
   * Get match count for a specific tournament
   */
  getTournamentMatchCount(tournamentData: any): number {
    console.log('🎯 Getting match count for tournament:', tournamentData);
    const matchCount = tournamentData.events?.reduce((total: number, event: any) => 
      total + (event.sets?.length || 0), 0) || 0;
    console.log(`📊 Tournament ${tournamentData.name || tournamentData.tournament?.name || 'Unknown'} has ${matchCount} total matches across ${tournamentData.events?.length || 0} events`);
    
    // If no matches found, log the structure for debugging
    if (matchCount === 0) {
      console.log('🐛 No matches found. Tournament structure:', {
        hasEvents: !!tournamentData.events,
        eventsLength: tournamentData.events?.length,
        firstEvent: tournamentData.events?.[0],
        eventsStructure: tournamentData.events?.map((e: any) => ({
          id: e.id,
          name: e.name,
          setsLength: e.sets?.length,
          hasSetsProp: 'sets' in e
        }))
      });
    }
    
    return matchCount;
  }

  /**
   * Get average number of entrants per tournament
   */
  getAverageEntrants(): number {
    if (this.rankingsTournaments.length === 0) return 0;
    return Math.round(this.rankingsTournaments.reduce((total, tournament) => 
      total + tournament.playerCount, 0) / this.rankingsTournaments.length);
  }

  /**
   * Recalculate TrueSkill ratings from all tournament data
   */
  recalculateRankings(): void {
    if (this.rankingsTournaments.length === 0) {
      return;
    }

    try {
      // Reset all player ratings
      this.rankingsPlayersData.clear();

      // Initialize TrueSkill environment
      const ts = new TrueSkill();

      // Process each tournament's data
      this.rankingsTournaments.forEach(tournament => {
        this.updateRankingsPlayerData(tournament);
        
        // Process matches for TrueSkill updates
        tournament.headToHeadMatrix.forEach(h2h => {
          // Simulate rating updates based on head-to-head records
          const player1Data = this.rankingsPlayersData.get(h2h.player1Tag);
          const player2Data = this.rankingsPlayersData.get(h2h.player2Tag);
          
          if (player1Data && player2Data) {
            // Calculate rating adjustment based on match results
            const winRate1 = h2h.player1Wins / h2h.totalSets;
            const adjustment = (winRate1 - 0.5) * 2; // -1 to 1 scale
            
            player1Data.skillRating += adjustment;
            player2Data.skillRating -= adjustment;
            player1Data.matches += h2h.totalSets;
            player2Data.matches += h2h.totalSets;
          }
        });
      });

      // Normalize ratings and calculate confidence
      this.normalizeRatings();

      // Save updated data to localStorage
      this.savePersistedTournamentData();

      this.setRankingsImportStatus('success', 'Rankings recalculated successfully');
    } catch (error) {
      console.error('Error recalculating rankings:', error);
      this.setRankingsImportStatus('error', 'Failed to recalculate rankings');
    }
  }

  /**
   * Remove a tournament from rankings data
   */
  removeRankingsTournament(slug: string): void {
    if (!confirm('Remove this tournament from rankings data?')) {
      return;
    }

    this.rankingsTournaments = this.rankingsTournaments.filter(t => t.tournament.slug !== slug);
    
    // Recalculate everything
    this.recalculateRankings();
    
    // Save updated data to localStorage
    this.savePersistedTournamentData();
    
    this.setRankingsImportStatus('success', 'Tournament removed and rankings updated');
  }

  /**
   * Get ranked players sorted by skill rating
   */
  getRankedPlayers(): Array<{
    playerName: string;
    displayRating: number;
    confidence: number;
    tournaments: number;
    avgPlacement: number;
    bestPlacement: number;
    top25Rate: number;
    consistencyRating: number;
  }> {
    const players = Array.from(this.rankingsPlayersData.entries()).map(([name, data]) => {
      const avgPlacement = data.placements.length > 0 ? 
        data.placements.reduce((sum, p) => sum + p, 0) / data.placements.length : 0;
      const bestPlacement = data.placements.length > 0 ? Math.min(...data.placements) : 0;
      
      // Calculate top 25% rate from stored data
      const top25Rate = data.top25Count !== undefined && data.tournaments > 0 ? 
        data.top25Count / data.tournaments : 0;
      
      // Use stored consistency rating or calculate from placement percentile
      const consistencyRating = data.consistencyRating !== undefined ? 
        data.consistencyRating : Math.max(0, 100 - (avgPlacement * 2)); // Simple fallback
      
      return {
        playerName: name,
        displayRating: data.displayRating,
        confidence: data.confidence,
        tournaments: data.tournaments,
        avgPlacement,
        bestPlacement,
        top25Rate,
        consistencyRating
      };
    });

    // Sort by top 25% rate first, then by consistency rating
    return players.sort((a, b) => {
      if (a.top25Rate !== b.top25Rate) {
        return b.top25Rate - a.top25Rate;
      }
      return b.consistencyRating - a.consistencyRating;
    });
  }

  /**
   * Get tournament-style ranking for a player at a given index
   * Handles tied rankings properly (e.g., if two players are tied for 3rd, both show "3rd", next player shows "5th")
   */
  getTournamentRank(players: any[], currentIndex: number): string {
    const currentPlayer = players[currentIndex];
    
    // Count how many players have strictly better performance
    let rank = 1;
    for (let i = 0; i < players.length; i++) {
      const otherPlayer = players[i];
      if (otherPlayer.top25Rate > currentPlayer.top25Rate || 
          (otherPlayer.top25Rate === currentPlayer.top25Rate && 
           otherPlayer.consistencyRating > currentPlayer.consistencyRating)) {
        rank++;
      }
    }
    
    return this.formatOrdinal(rank);
  }

  /**
   * Format number as ordinal (1st, 2nd, 3rd, 4th, etc.)
   */
  private formatOrdinal(num: number): string {
    const j = num % 10;
    const k = num % 100;
    
    if (j === 1 && k !== 11) return num + 'st';
    if (j === 2 && k !== 12) return num + 'nd';
    if (j === 3 && k !== 13) return num + 'rd';
    return num + 'th';
  }

  /**
   * Update player data from tournament
   */
  /**
   * Update rankings player data from tournament
   */
  private updateRankingsPlayerData(tournament: TournamentData): void {
    // Process players from the tournament data
    tournament.players.forEach((player, index) => {
      let playerData = this.rankingsPlayersData.get(player.tag);
      
      if (!playerData) {
        playerData = {
          playerName: player.tag,
          tournaments: 0,
          placements: [],
          matches: 0,
          skillRating: 25.0, // Default TrueSkill rating
          confidence: 0.5, // Default confidence
          displayRating: 25.0,
          top25Count: 0,
          consistencyRating: 50,
          totalEntrants: []
        };
        this.rankingsPlayersData.set(player.tag, playerData);
      }

      playerData.tournaments++;
      // Use the player's placement from their events or a default based on index
      const placement = player.events[0]?.placement || (index + 1);
      const totalEntrants = player.events[0]?.totalEntrants || tournament.playerCount;
      
      playerData.placements.push(placement);
      playerData.totalEntrants = playerData.totalEntrants || [];
      playerData.totalEntrants.push(totalEntrants);
      
      // Calculate if this was a top 25% finish
      const top25Threshold = Math.ceil(totalEntrants * 0.25);
      if (placement <= top25Threshold) {
        playerData.top25Count = (playerData.top25Count || 0) + 1;
      }
      
      // Update consistency rating based on placement percentile
      const placementPercentile = ((totalEntrants - placement + 1) / totalEntrants);
      const newConsistencyScore = placementPercentile * 100;
      
      // Average with existing consistency rating
      const currentRating = playerData.consistencyRating || 50;
      const tournamentCount = playerData.tournaments;
      playerData.consistencyRating = (currentRating * (tournamentCount - 1) + newConsistencyScore) / tournamentCount;
    });

    // Also process any placement data that exists in events
    tournament.events.forEach(event => {
      event.placement.forEach(placement => {
        let playerData = this.rankingsPlayersData.get(placement.playerTag);
        
        if (!playerData) {
          playerData = {
            playerName: placement.playerTag,
            tournaments: 0,
            placements: [],
            matches: 0,
            skillRating: 25.0,
            confidence: 0.5,
            displayRating: 25.0,
            top25Count: 0,
            consistencyRating: 50,
            totalEntrants: []
          };
          this.rankingsPlayersData.set(placement.playerTag, playerData);
        }

        playerData.tournaments++;
        playerData.placements.push(placement.placement);
        
        // Track tournament size and calculate top 25% performance
        const totalEntrants = event.numEntrants;
        playerData.totalEntrants = playerData.totalEntrants || [];
        playerData.totalEntrants.push(totalEntrants);
        
        // Calculate if this was a top 25% finish
        const top25Threshold = Math.ceil(totalEntrants * 0.25);
        if (placement.placement <= top25Threshold) {
          playerData.top25Count = (playerData.top25Count || 0) + 1;
        }
        
        // Update consistency rating based on placement percentile
        const placementPercentile = ((totalEntrants - placement.placement + 1) / totalEntrants);
        const newConsistencyScore = placementPercentile * 100;
        
        // Average with existing consistency rating
        const currentRating = playerData.consistencyRating || 50;
        const tournamentCount = playerData.tournaments;
        playerData.consistencyRating = (currentRating * (tournamentCount - 1) + newConsistencyScore) / tournamentCount;
      });
    });
  }

  /**
   * Normalize skill ratings and calculate display ratings
   */
  private normalizeRatings(): void {
    const players = Array.from(this.rankingsPlayersData.values());
    
    if (players.length === 0) return;

    // Calculate confidence based on number of matches
    players.forEach(player => {
      player.confidence = Math.min(1.0, player.matches / 20); // Full confidence at 20+ matches
      player.displayRating = player.skillRating;
    });

    // Normalize ratings to maintain reasonable scale
    const avgRating = players.reduce((sum, p) => sum + p.skillRating, 0) / players.length;
    const targetAvg = 25.0;
    const adjustment = targetAvg - avgRating;

    players.forEach(player => {
      player.skillRating += adjustment;
      player.displayRating = player.skillRating;
    });
  }

  /**
   * Set rankings import status message
   */
  private setRankingsImportStatus(
    type: 'success' | 'error' | 'warning', 
    message: string, 
    details?: string[]
  ): void {
    this.rankingsImportStatus = type;
    this.rankingsImportMessage = message;
    this.rankingsImportDetails = details || [];

    // Clear status after delay
    setTimeout(() => {
      if (type !== 'error') {
        this.rankingsImportStatus = null;
        this.rankingsImportMessage = '';
        this.rankingsImportDetails = [];
      }
    }, 5000);
  }

  // ===== BASELINE TOURNAMENT IMPORT METHODS =====

  /**
   * Get available tournaments for baseline import (excludes already imported ones)
   */
  getAvailableBaselineTournaments(): TournamentData[] {
    return this.recentImports.filter(tournament => 
      !this.rankingsTournaments.some(rt => rt.tournament.slug === tournament.tournament.slug)
    );
  }

  /**
   * Handle baseline tournament selection
   */
  onBaselineTournamentSelect(): void {
    this.baselineImportPreview = null;
    if (this.selectedBaselineTournament) {
      this.manualBaselineSlug = '';
    }
  }

  /**
   * Preview what would be imported from the selected tournament
   */
  previewBaselineImport(): void {
    const tournamentSlug = this.selectedBaselineTournament || this.manualBaselineSlug;
    if (!tournamentSlug.trim()) {
      return;
    }

    // Find tournament in recent imports
    const tournamentData = this.recentImports.find(t => t.tournament.slug === tournamentSlug);
    if (!tournamentData) {
      this.setRankingsImportStatus('warning', 'Tournament not found in recent imports. It will be imported from Start.gg.');
      return;
    }

    // Count how many would be new players
    const existingPlayers = this.getRankingsPlayers();
    const newPlayerCount = tournamentData.players.filter(player => 
      !existingPlayers.includes(player.tag)
    ).length;

    // Estimate matches from head-to-head data
    const estimatedMatches = tournamentData.headToHeadMatrix.reduce(
      (total, h2h) => total + h2h.totalSets, 0
    );

    this.baselineImportPreview = {
      tournamentName: tournamentData.tournament.name,
      playerCount: tournamentData.playerCount,
      eventCount: tournamentData.eventCount,
      estimatedMatches,
      newPlayers: newPlayerCount,
      date: tournamentData.importedAt
    };
  }

  /**
   * Import baseline tournament data
   */
  importBaselineTournament(): void {
    const tournamentSlug = this.selectedBaselineTournament || this.manualBaselineSlug;
    
    if (!tournamentSlug.trim()) {
      this.setRankingsImportStatus('error', 'Please select a tournament or enter a slug');
      return;
    }

    try {
      // First try to find in existing imports
      let tournamentData = this.recentImports.find(t => t.tournament.slug === tournamentSlug);
      
      if (!tournamentData) {
        // Import new tournament data
        this.setRankingsImportStatus('warning', 'Importing baseline tournament data...', [
          'Fetching tournament information',
          'Loading player performance data',
          'Calculating baseline skill ratings'
        ]);

        const importRequest: ImportRequest = {
          tournamentUrl: `https://start.gg/${tournamentSlug}`,
          importEvents: true,
          calculateRatings: this.baselineImportOptions.calculateSkillRatings,
          mergeWithExisting: false
        };

        this.startggService.importTournament(importRequest).subscribe({
          next: (importResult) => {
            if (!importResult.success || !importResult.data) {
              this.setRankingsImportStatus('error', importResult.message, importResult.errors);
              return;
            }

            const newTournamentData = importResult.data;
            this.recentImports.push(newTournamentData);
            this.processBaselineImport(newTournamentData);
          },
          error: (error) => {
            console.error('Error importing baseline tournament:', error);
            this.setRankingsImportStatus('error', 'Failed to import baseline tournament', [
              error instanceof Error ? error.message : 'Unknown error occurred'
            ]);
          }
        });
      } else {
        this.processBaselineImport(tournamentData);
      }

    } catch (error) {
      console.error('Error importing baseline tournament:', error);
      this.setRankingsImportStatus('error', 'Failed to import baseline tournament', [
        error instanceof Error ? error.message : 'Unknown error occurred'
      ]);
    }
  }

  /**
   * Process imported baseline tournament data
   */
  private processBaselineImport(tournamentData: TournamentData): void {
    // Check if already imported for rankings
    if (this.rankingsTournaments.some(rt => rt.tournament.slug === tournamentData.tournament.slug)) {
      this.setRankingsImportStatus('warning', 'Tournament already imported for rankings');
      return;
    }

    // Mark as baseline tournament if option is selected
    if (this.baselineImportOptions.setAsBaseline) {
      tournamentData.tournament.name = `[BASELINE] ${tournamentData.tournament.name}`;
    }

    // Add to rankings data if merge option is enabled
    if (this.baselineImportOptions.mergeWithExistingData) {
      this.rankingsTournaments.push(tournamentData);
      this.updateRankingsPlayerData(tournamentData);
      
      if (this.baselineImportOptions.calculateSkillRatings) {
        this.recalculateRankings();
      }
    }

    const newPlayers = tournamentData.players.filter(player => 
      !this.getRankingsPlayers().includes(player.tag)
    ).length;

    this.setRankingsImportStatus('success', 'Baseline tournament imported successfully!', [
      `${tournamentData.playerCount} players processed`,
      `${tournamentData.eventCount} events imported`,
      `${newPlayers} new players added to baseline`,
      'Data ready for house balancing'
    ]);

    // Clear form
    this.selectedBaselineTournament = '';
    this.manualBaselineSlug = '';
    this.baselineImportPreview = null;
  }
}
