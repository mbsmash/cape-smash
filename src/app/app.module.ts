import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HomeComponent } from './home/home.component';
import { MatCardModule } from '@angular/material/card';
import { MenuCardComponent } from './menu-card/menu-card.component';
import { StageListBansComponent } from './stage-list-bans/stage-list-bans.component';
import { PowerRankingsComponent } from './power-rankings/power-rankings.component';
import { CommunityComponent } from './community/community.component';
import { StageCardComponent } from './stage-card/stage-card.component';
import { HttpClientModule } from '@angular/common/http';
import { NavComponent } from './nav/nav.component';
import { PlayerCardComponent } from './player-card/player-card.component';
import { PowerRankingsFormComponent } from './power-rankings-form/power-rankings-form.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CopyrightComponent } from './copyright/copyright.component';
import { BannerComponent } from './banner/banner.component';
import { TournamentScheduleComponent } from './tournament-schedule/tournament-schedule.component'; // Import MatFormFieldModule
import { MatDividerModule } from '@angular/material/divider'; // Import MatDividerModule
import { StageListBansFullComponent } from './stage-list-bans-full/stage-list-bans-full.component';


@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    MenuCardComponent,
    StageListBansComponent,
    PowerRankingsComponent,
    CommunityComponent,
    StageCardComponent,
    NavComponent,
    PlayerCardComponent,
    PowerRankingsFormComponent,
    CopyrightComponent,
    BannerComponent,
    TournamentScheduleComponent,
    StageListBansFullComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatCardModule,
    HttpClientModule,
    MatFormFieldModule,
    MatDividerModule // Add MatFormFieldModule to the imports array
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
