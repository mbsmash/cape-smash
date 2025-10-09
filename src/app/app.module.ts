import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HomeComponent } from './home/home.component';
import { MatCardModule } from '@angular/material/card';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MenuCardComponent } from './menu-card/menu-card.component';
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
import { TournamentsComponent } from './tournaments/tournaments.component'; // Import MatFormFieldModule
import { MatDividerModule } from '@angular/material/divider'; // Import MatDividerModule
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { StageListBansFullComponent } from './stage-list-bans-full/stage-list-bans-full.component';
import { PlayerProfileComponent } from './player-profile/player-profile.component';
import { StreamingComponent } from './streaming/streaming.component';
import { SafeUrlPipe } from './safe-url.pipe';
import { CompetitionViewComponent } from './competition-view/competition-view.component';
import { CompetitionAdminComponent } from './competition-admin/competition-admin.component';
import { LoginComponent } from './login/login.component';
import { UnauthorizedComponent } from './unauthorized/unauthorized.component';


@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    MenuCardComponent,
    PowerRankingsComponent,
    CommunityComponent,
    StageCardComponent,
    NavComponent,
    PlayerCardComponent,
    PowerRankingsFormComponent,
    CopyrightComponent,
    BannerComponent,
    TournamentsComponent,
    StageListBansFullComponent,
    PlayerProfileComponent,
    StreamingComponent,
    SafeUrlPipe,
    CompetitionViewComponent,
    CompetitionAdminComponent,
    LoginComponent,
    UnauthorizedComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    HttpClientModule,
    MatFormFieldModule,
    MatDividerModule, // Add MatFormFieldModule to the imports array
    MatSidenavModule,
    MatToolbarModule,
    MatDialogModule,
    MatButtonModule,
    MatInputModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
