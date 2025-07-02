import { Component, OnInit } from '@angular/core';
import { PlayerRecord, PowerRankingService } from '../services/power-ranking.service';

@Component({
  selector: 'app-power-rankings',
  templateUrl: './power-rankings.component.html',
  styleUrls: ['./power-rankings.component.css']
})
export class PowerRankingsComponent implements OnInit {

  records: PlayerRecord[] = [];

  constructor(private prService: PowerRankingService) {}

  ngOnInit(): void {
    // Example event ids array; in a real app these would be provided by user input
    this.prService.computeSeason([]).then(r => this.records = r);
  }
}
