import { Component, OnInit } from '@angular/core';
import { PlayerRecord, PowerRankingService } from '../services/power-ranking.service';

@Component({
  selector: 'app-power-rankings',
  templateUrl: './power-rankings.component.html',
  styleUrls: ['./power-rankings.component.css']
})
export class PowerRankingsComponent implements OnInit {

  records: PlayerRecord[] = [];
  tournamentSlug: string = '';
  isImporting: boolean = false;
  showAllPlayers: boolean = false; // Toggle for showing all vs filtered players

  constructor(private prService: PowerRankingService) {}

  ngOnInit(): void {
    // Load the current filtered records (may be empty initially)
    this.refreshRecords();
  }

  async importTournament(): Promise<void> {
    if (!this.tournamentSlug.trim()) {
      alert('Please enter a tournament slug');
      return;
    }

    this.isImporting = true;
    try {
      this.records = await this.prService.importTournament(this.tournamentSlug.trim());
      this.refreshRecords(); // Apply current filter after import
      alert(`Successfully imported tournament: ${this.tournamentSlug}`);
    } catch (error) {
      console.error('Error importing tournament:', error);
      // Better error message formatting
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
        // Special handling for API token errors
        if (errorMessage.includes('API token is not configured')) {
          errorMessage += '\n\nTo fix this:\n1. Go to https://start.gg/admin/profile/developer\n2. Create a new personal access token\n3. Add it to src/environments/environment.ts';
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error, null, 2);
      }
      alert(`Error importing tournament: ${errorMessage}`);
    } finally {
      this.isImporting = false;
    }
  }

  clearRankings(): void {
    this.prService.clearRecords();
    this.refreshRecords();
  }

  /**
   * Load sample tournament data from two real start.gg tournaments:
   * - Kachow Kup
   * - Heartland Arena (Heartland Gaming Con)
   */
  async loadTestData(): Promise<void> {
    this.isImporting = true;
    try {
      console.log('=== Starting sample data import ===');
      
      // Import first tournament
      console.log('1. Importing Kachow Kup tournament...');
      await this.prService.importTournament('kachow-kup');
      console.log('✓ Kachow Kup import completed');
      console.log('Current tournament history length:', this.prService.getTournamentHistory().length);
      
      // Import second tournament with detailed error handling
      console.log('2. Importing Heartland Arena tournament...');
      try {
        await this.prService.importTournament('heartland-arena-heartland-gaming-con');
        console.log('✓ Heartland Arena import completed');
      } catch (error) {
        console.error('Detailed error for Heartland Arena:', error);
        if (error instanceof Error) {
          console.error('Error message:', error.message);
          console.error('Error stack:', error.stack);
        }
        // Continue anyway - we still have Kachow Kup data
        console.log('Continuing with Kachow Kup data only...');
      }
      
      console.log('Final tournament history length:', this.prService.getTournamentHistory().length);
      
      // Log tournament results for debugging
      const tournamentResults = this.prService.getRecentTournamentResults(100);
      console.log('Tournament results found:', tournamentResults.length);
      tournamentResults.forEach(result => {
        console.log(`- Tournament: ${result.tournamentName}, Date: ${result.date}, Rounds: ${result.roundGroups.length}`);
      });
      
      this.refreshRecords();
      alert('Tournament import completed! Check console for details.');
    } catch (error) {
      console.error('Error importing tournament data:', error);
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
        if (errorMessage.includes('API token is not configured')) {
          errorMessage += '\n\nTo fix this:\n1. Go to https://start.gg/admin/profile/developer\n2. Create a new personal access token\n3. Add it to src/environments/environment.ts';
        }
      }
      alert(`Error importing tournament data: ${errorMessage}`);
    } finally {
      this.isImporting = false;
    }
  }

  recalculateTrueSkill(): void {
    this.prService.recalculateTrueSkillRatings();
    this.refreshRecords();
    alert('TrueSkill ratings have been recalculated based on tournament history');
  }

  resetSeason(): void {
    if (confirm('Are you sure you want to reset the season? This will reset all player ratings and points but keep their match history.')) {
      this.prService.resetSeason();
      this.refreshRecords();
      alert('Season has been reset. All ratings and points have been reset to default values.');
    }
  }

  togglePlayerFilter(): void {
    this.showAllPlayers = !this.showAllPlayers;
    this.refreshRecords();
  }

  getTrueSkillDisplay(record: PlayerRecord): number {
    return this.prService.getTrueSkillDisplayRating(record);
  }

  getTrueSkillMu(record: PlayerRecord): number {
    return this.prService.getTrueSkillMu(record);
  }

  getTrueSkillSigma(record: PlayerRecord): number {
    return this.prService.getTrueSkillSigma(record);
  }

  getWinRate(record: PlayerRecord): number {
    const total = record.wins + record.losses;
    if (total === 0) return 0;
    return Math.round((record.wins / total) * 100);
  }

  getDisplayPoints(record: PlayerRecord): number {
    return this.prService.getDisplayPoints(record);
  }

  private refreshRecords(): void {
    this.records = this.showAllPlayers ? 
      this.prService.getRecords() : 
      this.prService.getFilteredRecords();
  }

  get totalPlayers(): number {
    return this.prService.getRecords().length;
  }

  get filteredPlayers(): number {
    return this.prService.getFilteredRecords().length;
  }

  get hasStoredData(): boolean {
    return this.totalPlayers > 0;
  }
}
