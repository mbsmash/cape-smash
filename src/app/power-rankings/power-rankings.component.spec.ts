import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PowerRankingsComponent } from './power-rankings.component';
import { PowerRankingService, PlayerRecord } from '../services/power-ranking.service';

class MockPowerRankingService {
  computeSeason() { return Promise.resolve([] as PlayerRecord[]); }
}

describe('PowerRankingsComponent', () => {
  let component: PowerRankingsComponent;
  let fixture: ComponentFixture<PowerRankingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PowerRankingsComponent ],
      providers: [ { provide: PowerRankingService, useClass: MockPowerRankingService } ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PowerRankingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
