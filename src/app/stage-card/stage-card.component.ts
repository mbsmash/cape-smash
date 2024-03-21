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

  @Output() stageBanned = new EventEmitter<Stage>();
  @Output() stageUnbanned = new EventEmitter<Stage>();

  stageImageUrl: string = '';

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
    return await this.firebaseStorageService.getImageUrl(`/stages/` + stage +  `.png`);
  }


  isBanned: boolean = false;

  onClick(): void {
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

}
