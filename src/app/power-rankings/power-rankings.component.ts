import { Component, OnInit } from '@angular/core';
import { Fighter } from 'src/models/fighter';
import { FighterService } from '../services/fighter.service';
import { Player } from 'src/models/player';
import { PlayerService } from '../services/player.service';

@Component({
  selector: 'app-power-rankings',
  templateUrl: './power-rankings.component.html',
  styleUrls: ['./power-rankings.component.css']
})
export class PowerRankingsComponent implements OnInit {

  samplePlayers: number[] = [];

  constructor(
    private fighterService: FighterService,
    private playerService: PlayerService
  ) {
   }

  ngOnInit(): void {
  }

  buildPlayer(playerId: number): Player {
    return this.playerService.players[playerId];
  }

}
