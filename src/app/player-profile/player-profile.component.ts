import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PlayerRecord, PowerRankingService } from '../services/power-ranking.service';

@Component({
  selector: 'app-player-profile',
  templateUrl: './player-profile.component.html',
  styleUrls: ['./player-profile.component.css']
})
export class PlayerProfileComponent implements OnInit {

  player: PlayerRecord | undefined;
  playerId: number | undefined;
  allPlayers: PlayerRecord[] = [];
  headToHeadRecords: {player: PlayerRecord, wins: number, losses: number}[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private prService: PowerRankingService
  ) { }

  ngOnInit(): void {
    // Get player ID from route parameters
    this.route.params.subscribe(params => {
      this.playerId = Number(params['id']);
      this.loadPlayerData();
    });
  }

  private loadPlayerData(): void {
    if (!this.playerId) return;

    // Get the specific player
    this.player = this.prService.getRecord(this.playerId);
    
    if (!this.player) {
      // Player not found, redirect back to power rankings
      this.router.navigate(['/power-rankings']);
      return;
    }

    // Get all players for head-to-head calculations
    this.allPlayers = this.prService.getRecords();
    
    // Build head-to-head records
    this.buildHeadToHeadRecords();
  }

  private buildHeadToHeadRecords(): void {
    if (!this.player) return;

    this.headToHeadRecords = [];
    
    // Go through all head-to-head data for this player
    Object.keys(this.player.headToHead).forEach(opponentIdStr => {
      const opponentId = Number(opponentIdStr);
      const h2hData = this.player!.headToHead[opponentId];
      const opponent = this.prService.getRecord(opponentId);
      
      if (opponent && (h2hData.wins > 0 || h2hData.losses > 0)) {
        this.headToHeadRecords.push({
          player: opponent,
          wins: h2hData.wins,
          losses: h2hData.losses
        });
      }
    });

    // Sort by total games played (most active matchups first)
    this.headToHeadRecords.sort((a, b) => {
      const aTotalGames = a.wins + a.losses;
      const bTotalGames = b.wins + b.losses;
      return bTotalGames - aTotalGames;
    });
  }

  get winRate(): number {
    if (!this.player) return 0;
    const totalGames = this.player.wins + this.player.losses;
    return totalGames > 0 ? (this.player.wins / totalGames) * 100 : 0;
  }

  get currentRank(): number {
    if (!this.player) return 0;
    const rankedPlayers = this.prService.getFilteredRecords();
    return rankedPlayers.findIndex(p => p.id === this.player!.id) + 1;
  }

  getHeadToHeadWinRate(record: {wins: number, losses: number}): number {
    const total = record.wins + record.losses;
    return total > 0 ? (record.wins / total) * 100 : 0;
  }

  getTrueSkillDisplay(): number {
    if (!this.player) return 0;
    return this.prService.getTrueSkillDisplayRating(this.player);
  }

  getTrueSkillMu(): number {
    if (!this.player) return 0;
    return this.prService.getTrueSkillMu(this.player);
  }

  getTrueSkillSigma(): number {
    if (!this.player) return 0;
    return this.prService.getTrueSkillSigma(this.player);
  }

  getDisplayPoints(): number {
    if (!this.player) return 0;
    return this.prService.getDisplayPoints(this.player);
  }

  goBack(): void {
    this.router.navigate(['/power-rankings']);
  }
}
