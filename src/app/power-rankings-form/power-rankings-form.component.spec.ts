import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PowerRankingsFormComponent } from './power-rankings-form.component';

describe('PowerRankingsFormComponent', () => {
  let component: PowerRankingsFormComponent;
  let fixture: ComponentFixture<PowerRankingsFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PowerRankingsFormComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PowerRankingsFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
