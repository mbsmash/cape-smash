import { Component, Input, OnInit } from '@angular/core';
import { Stage } from 'src/models/stage';
import { ChangeDetectorRef } from '@angular/core';
import StageListService from '../services/stage-list.service';

@Component({
  selector: 'app-stage-list-bans',
  templateUrl: './stage-list-bans.component.html',
  styleUrls: ['./stage-list-bans.component.css']
})
export class StageListBansComponent implements OnInit {

  starterStages: Stage[] = [];
  counterpickStages: Stage[] = [];
  bannedList: any[] = [];

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
    this.bannedList.push(stage);
  }

  handleStageUnbanned(stage: Stage) {
    stage.isBanned = false;
    this.bannedList = this.bannedList.filter((bannedStage) => bannedStage.id !== stage.id);

  }

  resetBanList() {
    this.bannedList = [];
    this.starterStages = this.starterStages.map(stage => ({ ...stage, isBanned: false }));
    this.counterpickStages = this.counterpickStages.map(stage => ({ ...stage, isBanned: false }));
  }

  handleNoBans() {
    this.resetBanList();
    // Optionally, you could add logic here to disable further banning if needed
  }

}
