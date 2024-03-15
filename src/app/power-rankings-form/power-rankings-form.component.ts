import { Component, OnInit } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field'; // Import MatFormFieldModule


@Component({
  selector: 'app-power-rankings-form',
  templateUrl: './power-rankings-form.component.html',
  styleUrls: ['./power-rankings-form.component.css']
})
export class PowerRankingsFormComponent implements OnInit {

  numberOfPlayers = 8;

  constructor() { }

  ngOnInit(): void {
  }

}
