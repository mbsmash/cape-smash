import { Component, Input, OnInit } from '@angular/core';
import { Stage } from 'src/models/stage';
import { ChangeDetectorRef } from '@angular/core';
import StageListService from '../services/stage-list.service';


@Component({
  selector: 'app-stage-list-bans-full',
  templateUrl: './stage-list-bans-full.component.html',
  styleUrls: ['./stage-list-bans-full.component.css']
})
export class StageListBansFullComponent implements OnInit {


  selectedStage: Stage | null = null;
  starterStages: Stage[] = [];
  counterpickStages: Stage[] = [];
  bannedList: any[] = [];
  isBanning: boolean = true;
  isPicking: boolean = false;
  noBans: boolean = false;

  constructor(
    private stageListService: StageListService,
    private cd: ChangeDetectorRef
    ) { }

  ngOnInit(): void {
    //get stages and filter them into starter and counterpick stages
    this.stageListService.getStageList().subscribe((stages: Stage[]) => {
      this.starterStages = stages.filter((stage) => stage.isCounterpick === false);
      this.counterpickStages = stages.filter((stage) => stage.isCounterpick === true);
    });
  }

  handleStageBanned(stage: Stage) {
    if(this.isBanning) {
      this.bannedList.push(stage);
      if(this.bannedList.length === 3) {
        this.enableStagePick();
      }
    }
  }

  handleStageUnbanned(stage: Stage) {
    stage.isBanned = false;
    this.bannedList = this.bannedList.filter((bannedStage) => bannedStage.id !== stage.id);

  }

  resetBanList() {
    this.bannedList = [];
    this.starterStages = this.starterStages.map(stage => ({ ...stage, isBanned: false }));
    this.counterpickStages = this.counterpickStages.map(stage => ({ ...stage, isBanned: false }));
    this.isBanning = true;
    this.isPicking = false;
    window.location.reload();
  }

  enableStagePick() {
    if(this.bannedList.length = 3 || this.noBans == true) {
      console.log("Stage pick enabled");
      this.isBanning = false;
      this.isPicking = true;
    }
  }

  handleStagePick(stage: Stage) {
    this.selectedStage = stage;
  }

  handleNoBans() {
    this.enableStagePick();
  }

}
