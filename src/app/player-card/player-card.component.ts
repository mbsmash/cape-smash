import { Component, OnInit } from '@angular/core';
import { Input } from '@angular/core';
import { Fighter } from 'src/models/fighter';
import { FighterService } from '../services/fighter.service';
import { Player } from 'src/models/player';
import { PlayerService } from '../services/player.service';
import { FirebaseStorageService } from '../services/firebase-storage.service';

@Component({
  selector: 'app-player-card',
  templateUrl: './player-card.component.html',
  styleUrls: ['./player-card.component.css']
})
export class PlayerCardComponent implements OnInit {

  @Input() playerId: number;
  @Input() rank: number;
  mainCharacterImageUrl: string = '';

  player: Player = {
    id: 0,
    displayName: "",
    rank: 0,
    mainCharacter: {
      id: 0, codename: "", displayName: "", path: "", alternates: []
    },
    secondaryCharacters: []
  };

  constructor(
    private fighterService: FighterService,
    private playerService: PlayerService,
    private firebaseStorageService: FirebaseStorageService
  ) {
    this.playerId = 0;
    this.player = this.getRandomPlayer();
    this.rank = 0;

  }

  ngOnInit(): void {
    this.getMainCharacterImage().then(url => {
      this.mainCharacterImageUrl = url;
    });
    this.player = this.getRandomPlayer();
    this.isPlayerSoloMain();
  }

  getRandomPlayer(): Player {
    return this.playerService.getRandomPlayer();
  }

  //todo make this the card background instead of an icon. Should make styling easier
  //TODO add firebase storage path to image path
  async getMainCharacterImage(): Promise<string> {
    return await this.firebaseStorageService.getImageUrl(`assets/fighter-portraits/chara_1_` + this.player.mainCharacter.displayName + `_00.jpg`);

  }

  getMainCharacterInfo(displayName: string): Fighter {
    return this.fighterService.getFighterByDisplayName(displayName);
  }

  getSecondaryCharacterImage(displayName: string): string {
    for (let i = 0; i < this.player.secondaryCharacters.length; i++) {
      if (this.player.secondaryCharacters[i].displayName === displayName) {
        return "/assets/images/fighter-portraits/" + this.player.secondaryCharacters[i].path + "/chara_1_" + this.player.secondaryCharacters[i].codename + "_00.png";
      }
    }
    return "holla";
  }

  getSecondaryCharacterInfo(displayNames: string[]): Fighter[] {
    return displayNames.map(displayName => this.fighterService.getFighterByDisplayName(displayName));
  }

  isPlayerSoloMain(): boolean {
    return this.player.secondaryCharacters.length === 0;
  }
}
