import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompetitionAdminComponent } from './competition-admin.component';

describe('CompetitionAdminComponent', () => {
  let component: CompetitionAdminComponent;
  let fixture: ComponentFixture<CompetitionAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CompetitionAdminComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CompetitionAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
