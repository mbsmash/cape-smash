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
}
