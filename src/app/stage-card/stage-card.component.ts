import { Component, OnInit, EventEmitter, Output, Input } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Stage } from 'src/models/stage';
import { FirebaseService } from '../services/firebase.service';
import { StageListService } from '../services/stage-list.service';

@Component({
  selector: 'app-stage-card',
  templateUrl: './stage-card.component.html',
  styleUrls: ['./stage-card.component.css']
})
export class StageCardComponent implements OnInit {

  @Input() stage!: Stage;
  @Input() isPicking: boolean = false;

  @Output() stageBanned = new EventEmitter<Stage>();
  @Output() stageUnbanned = new EventEmitter<Stage>();
  @Output() stagePicked = new EventEmitter<Stage>();

  stageImageUrl: string = '';
  @Input() isPicked: boolean = false;

  constructor(
    private router: Router,
    private firebaseStorageService: FirebaseService,
    private stageListService: StageListService
  ) {
  }

  ngOnInit(): void {
    this.getStageImage().then(url => {
      this.stageImageUrl = url;
    });
  }
  
  async getStageImage(): Promise<string> {
    const stage = this.stageListService.parseImagePath(this.stage.name);
    const localStorageKey = `stageImage-${stage}`;

    const cachedImageUrl = localStorage.getItem(localStorageKey);
    if(cachedImageUrl) {
      return cachedImageUrl;
    }

    const imageUrl = await this.firebaseStorageService.getImageUrl(`/stages/` + stage +  `.png`);

    localStorage.setItem(localStorageKey, imageUrl);
    return imageUrl;
  }


  isBanned: boolean = false;

  onClick(): void {
    if(!this.isPicking) {
      //If an unbanned stage is clicked, it will be added to the ban list.
      this.isBanned = !this.isBanned;
      if (this.isBanned) {
        this.stageBanned.emit(this.stage);
      }
      //If a banned stage is clicked, it will be removed from the ban list.
      else {
        this.stageUnbanned.emit(this.stage);
      }
    }
    else {
      this.isPicked = true;
      this.stagePicked.emit(this.stage);
    }
  }

}
