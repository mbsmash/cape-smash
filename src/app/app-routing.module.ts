import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { PowerRankingsComponent } from './power-rankings/power-rankings.component';
import { CommunityComponent } from './community/community.component';
import { PowerRankingsFormComponent } from './power-rankings-form/power-rankings-form.component';
import { TournamentsComponent } from './tournaments/tournaments.component';
import { StageListBansFullComponent } from './stage-list-bans-full/stage-list-bans-full.component';
import { PlayerProfileComponent } from './player-profile/player-profile.component';
import { StreamingComponent } from './streaming/streaming.component';
import { CompetitionViewComponent } from './competition-view/competition-view.component';
import { CompetitionAdminComponent } from './competition-admin/competition-admin.component';
import { UnauthorizedComponent } from './unauthorized/unauthorized.component';
import { AdminGuard } from './guards/auth.guard';
import { Permission } from '../models/user';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'power-rankings', component: PowerRankingsComponent},
  { path: 'community', component: CommunityComponent},
  { path: 'power-rankings-form', component: PowerRankingsFormComponent},
  { path: 'tournaments', component: TournamentsComponent},
  { path: 'stage-list-bans-full', component: StageListBansFullComponent},
  { path: 'player/:id', component: PlayerProfileComponent},
  { path: 'streaming', component: StreamingComponent},
  { path: 'season-6', component: CompetitionViewComponent},
  { path: 'competition', redirectTo: '/season-6', pathMatch: 'full' }, // Redirect old URL
  { 
    path: 'competition-admin', 
    component: CompetitionAdminComponent,
    canActivate: [AdminGuard],
    data: { 
      permissions: [Permission.VIEW_ADMIN_PANEL] 
    }
  },
  { path: 'unauthorized', component: UnauthorizedComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
