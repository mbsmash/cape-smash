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
  secondaryCharacterImageUrls: string[] = [];

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
      this.player = this.getRandomPlayer();
      this.isPlayerSoloMain();
      this.getMainCharacterImage().then(url => {
        this.mainCharacterImageUrl = url;
        console.log(this.mainCharacterImageUrl)
      });
      this.getSecondaryCharacterImages(this.player.secondaryCharacters);
    }

    getRandomPlayer(): Player {
      return this.playerService.getRandomPlayer();
  }

  //todo make this the card background instead of an icon. Should make styling easier
  //TODO add firebase storage path to image path
  async getMainCharacterImage(): Promise<string> {
    return await this.firebaseStorageService.getImageUrl(`/fighter-portraits/chara_1_` + this.player.mainCharacter.codename + `_00.jpg`);

  }

  getMainCharacterInfo(displayName: string): Fighter {
    return this.fighterService.getFighterByDisplayName(displayName);
  }

  async getSecondaryCharacterImages(secondaryCharacters: Fighter[]): Promise<string[]> {
    let urls = [];
    for (let i = 0; i < secondaryCharacters.length; i++) {
      urls.push(await this.firebaseStorageService.getImageUrl(`/stock-icons/chara_2_` + secondaryCharacters[i].codename + `_00.png`));
    }
    return ["holla"];
  }

  getSecondaryCharacterInfo(displayNames: string[]): Fighter[] {
    return displayNames.map(displayName => this.fighterService.getFighterByDisplayName(displayName));
  }

  isPlayerSoloMain(): boolean {
    return this.player.secondaryCharacters.length === 0;
  }
}
