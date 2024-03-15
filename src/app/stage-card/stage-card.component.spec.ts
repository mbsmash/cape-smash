import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StageCardComponent } from './stage-card.component';

describe('StageCardComponent', () => {
  let component: StageCardComponent;
  let fixture: ComponentFixture<StageCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ StageCardComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StageCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
