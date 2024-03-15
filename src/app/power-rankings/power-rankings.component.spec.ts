import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PowerRankingsComponent } from './power-rankings.component';

describe('PowerRankingsComponent', () => {
  let component: PowerRankingsComponent;
  let fixture: ComponentFixture<PowerRankingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PowerRankingsComponent ]
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
