import { Component, OnInit } from '@angular/core';
import { PowerRankingService } from '../services/power-ranking.service';

interface TournamentResult {
  tournamentName: string;
  date: Date;
  roundGroups: Array<{
    roundName: string;
    sets: Array<{
      player1: string;
      player2: string;
      winner: string;
      setId: string;
      score?: string;
      totalGames?: number;
      vodUrl?: string;
      completedAt?: Date;
      games?: Array<{
        orderNum: number;
        player1Score: number;
        player2Score: number;
        player1Characters?: string[];
        player2Characters?: string[];
      }>;
    }>;
  }>;
}

@Component({
  selector: 'app-tournaments',
  templateUrl: './tournaments.component.html',
  styleUrls: ['./tournaments.component.css']
})
export class TournamentsComponent implements OnInit {
  tournamentResults: TournamentResult[] = [];
  loading: boolean = true;

  constructor(private powerRankingService: PowerRankingService) { }

  ngOnInit(): void {
    this.loadTournamentResults();
  }

  private loadTournamentResults(): void {
    try {
      console.log('Loading tournament results...');
      this.tournamentResults = this.powerRankingService.getRecentTournamentResults(100);
      console.log('Tournament results loaded:', this.tournamentResults);
      console.log('Number of tournaments:', this.tournamentResults.length);
      this.loading = false;
    } catch (error) {
      console.error('Error loading tournament results:', error);
      this.loading = false;
    }
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getPlayerScore(set: any, playerName: string): string {
    console.log('getPlayerScore called with:', { set, playerName });
    console.log('set.score:', set.score);
    console.log('set object keys:', Object.keys(set));
    
    if (!set.score) {
      console.log('No score found, returning 0');
      return '0';
    }
    
    // Extract the actual game score from concatenated string
    // Format: "PlayerName | PlayerName Score - PlayerName/PlayerName | PlayerName Score"
    const gameScore = this.extractGameScore(set.score);
    console.log('Extracted game score:', gameScore);
    
    if (!gameScore) {
      console.log('No game score extracted, returning 0');
      return '0';
    }
    
    const scores = gameScore.split('-');
    if (scores.length !== 2) {
      console.log('Invalid game score format:', gameScore);
      return '0';
    }
    
    const score1 = parseInt(scores[0].trim());
    const score2 = parseInt(scores[1].trim());
    
    // Check for invalid numbers
    if (isNaN(score1) || isNaN(score2)) {
      console.log('Invalid score numbers:', scores);
      return '0';
    }
    
    // Determine which score belongs to which player
    if (set.winner === playerName) {
      // Winner gets the higher score
      return Math.max(score1, score2).toString();
    } else {
      // Loser gets the lower score
      return Math.min(score1, score2).toString();
    }
  }

  // Helper method to extract game score from concatenated string
  // Input: "Kachow | Kachow 3 - Lincorp/Kachow | Xpression 1"
  // Output: "3-1"
  private extractGameScore(scoreString: string): string {
    console.log('Extracting game score from:', scoreString);
    
    // Look for pattern: "number - text | text number"
    // We want to extract the numbers at the end of each side
    const parts = scoreString.split(' - ');
    if (parts.length !== 2) return '';
    
    // Extract number from the end of first part
    const firstMatch = parts[0].match(/(\d+)$/);
    const firstScore = firstMatch ? firstMatch[1] : '';
    
    // Extract number from the end of second part  
    const secondMatch = parts[1].match(/(\d+)$/);
    const secondScore = secondMatch ? secondMatch[1] : '';
    
    if (!firstScore || !secondScore) return '';
    
    const result = `${firstScore}-${secondScore}`;
    console.log('Extracted game score result:', result);
    return result;
  }

  getGameScore(set: any): string {
    if (!set.score) return '';
    
    // Extract and return the game score like "3-1", "3-2", etc.
    return this.extractGameScore(set.score);
  }

  // Extract sponsor tag from player name (e.g., "[TSM] PlayerName" -> "TSM")
  getSponsor(playerName: string): string {
    const sponsorMatch = playerName.match(/^\[([^\]]+)\]/);
    return sponsorMatch ? sponsorMatch[1] : '';
  }

  // Get player name without sponsor tag
  getPlayerNameWithoutSponsor(playerName: string): string {
    return playerName.replace(/^\[([^\]]+)\]\s*/, '');
  }

  // Method to group rounds for efficient display on larger screens
  // Rounds with 1-2 sets can be displayed side-by-side with a maximum of 4 sets per row
  groupRoundsForDisplay(roundGroups: any[]): any[][] {
    // First, sort rounds according to tournament bracket order
    const sortedRoundGroups = [...roundGroups].sort((a, b) => {
      return this.getRoundPriority(a.roundName) - this.getRoundPriority(b.roundName);
    });
    
    const grouped: any[][] = [];
    let currentGroup: any[] = [];
    let currentSetCount = 0;
    const maxSetsPerRow = 4;
    
    for (let i = 0; i < sortedRoundGroups.length; i++) {
      const roundGroup = sortedRoundGroups[i];
      const roundSetCount = roundGroup.sets.length;
      
      // Special case: Group Grand Finals with Losers Finals if both exist and have 1-2 sets each
      if (this.isGrandFinals(roundGroup.roundName) && roundSetCount <= 2) {
        // Look for Losers Finals in the remaining rounds
        const losersFinalIndex = sortedRoundGroups.findIndex((rg, index) => 
          index > i && this.isLosersFinals(rg.roundName) && rg.sets.length <= 2
        );
        
        if (losersFinalIndex !== -1 && (roundSetCount + sortedRoundGroups[losersFinalIndex].sets.length) <= maxSetsPerRow) {
          // Group Grand Finals with Losers Finals
          currentGroup.push(roundGroup);
          currentGroup.push(sortedRoundGroups[losersFinalIndex]);
          grouped.push([...currentGroup]);
          currentGroup = [];
          currentSetCount = 0;
          
          // Remove the Losers Finals from future processing
          sortedRoundGroups.splice(losersFinalIndex, 1);
          continue;
        }
      }
      
      // If this round has 1-2 sets and can fit within our max limit
      if (roundSetCount <= 2 && (currentSetCount + roundSetCount) <= maxSetsPerRow) {
        currentGroup.push(roundGroup);
        currentSetCount += roundSetCount;
        
        // If we've reached the maximum sets per row, finalize this group
        if (currentSetCount === maxSetsPerRow) {
          grouped.push([...currentGroup]);
          currentGroup = [];
          currentSetCount = 0;
        }
      } else {
        // If we have pending rounds in the current group, finalize it first
        if (currentGroup.length > 0) {
          grouped.push([...currentGroup]);
          currentGroup = [];
          currentSetCount = 0;
        }
        
        // Add this round as its own group (it has too many sets or won't fit)
        grouped.push([roundGroup]);
      }
    }
    
    // Don't forget any remaining rounds in the current group
    if (currentGroup.length > 0) {
      grouped.push([...currentGroup]);
    }
    
    return grouped;
  }

  // Helper methods to identify specific round types
  private isGrandFinals(roundName: string): boolean {
    return roundName.toLowerCase().includes('grand final');
  }

  private isLosersFinals(roundName: string): boolean {
    return roundName.toLowerCase().includes('losers final') && 
           !roundName.toLowerCase().includes('semi') && 
           !roundName.toLowerCase().includes('quarter');
  }

  // Helper method to determine the display priority of rounds
  // Lower numbers = higher priority (displayed first)
  private getRoundPriority(roundName: string): number {
    const name = roundName.toLowerCase();
    
    // Grand Finals always first
    if (name.includes('grand final')) return 1;
    
    // Losers Finals
    if (name.includes('losers final') && !name.includes('semi') && !name.includes('quarter')) return 2;
    
    // Losers Semi-Finals
    if (name.includes('losers') && name.includes('semi')) return 3;
    
    // Winners Finals
    if (name.includes('winners final') && !name.includes('semi') && !name.includes('quarter')) return 4;
    
    // Losers Quarter-Finals
    if (name.includes('losers') && name.includes('quarter')) return 5;
    
    // Winners Semi-Finals
    if (name.includes('winners') && name.includes('semi')) return 6;
    
    // Winners Quarter-Finals
    if (name.includes('winners') && name.includes('quarter')) return 7;
    
    // Extract numbered rounds (e.g., "Losers Round 6", "Winners Round 4")
    const losersRoundMatch = name.match(/losers.*round.*(\d+)/);
    if (losersRoundMatch) {
      const roundNum = parseInt(losersRoundMatch[1]);
      return 100 + (20 - roundNum); // Higher round numbers get lower priority numbers
    }
    
    const winnersRoundMatch = name.match(/winners.*round.*(\d+)/);
    if (winnersRoundMatch) {
      const roundNum = parseInt(winnersRoundMatch[1]);
      return 200 + (20 - roundNum); // Higher round numbers get lower priority numbers
    }
    
    // Any other rounds get very low priority
    return 1000;
  }
}
