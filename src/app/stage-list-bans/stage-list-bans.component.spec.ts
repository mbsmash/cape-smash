import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StageListBansComponent } from './stage-list-bans.component';

describe('StageListBansComponent', () => {
  let component: StageListBansComponent;
  let fixture: ComponentFixture<StageListBansComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ StageListBansComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StageListBansComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
