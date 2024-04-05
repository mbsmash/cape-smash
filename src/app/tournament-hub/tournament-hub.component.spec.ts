import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TournamentHubComponent } from './tournament-hub.component';

describe('TournamentHubComponent', () => {
  let component: TournamentHubComponent;
  let fixture: ComponentFixture<TournamentHubComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TournamentHubComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TournamentHubComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
