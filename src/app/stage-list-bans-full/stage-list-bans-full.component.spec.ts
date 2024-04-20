import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StageListBansComponent as StageListBansFullComponent } from './stage-list-bans-full.component';

describe('StageListBansComponent', () => {
  let component: StageListBansFullComponent;
  let fixture: ComponentFixture<StageListBansFullComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ StageListBansFullComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StageListBansFullComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
