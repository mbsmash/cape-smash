import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { StageListBansComponent } from './stage-list-bans/stage-list-bans.component';
import { PowerRankingsComponent } from './power-rankings/power-rankings.component';
import { CommunityComponent } from './community/community.component';
import { PowerRankingsFormComponent } from './power-rankings-form/power-rankings-form.component';


const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'stage-list-bans', component: StageListBansComponent},
  { path: 'power-rankings', component: PowerRankingsComponent},
  { path: 'community', component: CommunityComponent},
  { path: 'power-rankings-form', component: PowerRankingsFormComponent}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
