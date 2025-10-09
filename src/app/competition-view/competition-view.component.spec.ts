import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompetitionViewComponent } from './competition-view.component';

describe('CompetitionViewComponent', () => {
  let component: CompetitionViewComponent;
  let fixture: ComponentFixture<CompetitionViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CompetitionViewComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CompetitionViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
