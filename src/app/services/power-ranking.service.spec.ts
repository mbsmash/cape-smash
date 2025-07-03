import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { GgPlayer, GgSet } from 'src/models/startgg';
import { PowerRankingService } from './power-ranking.service';
import { StartggService } from './startgg.service';

class MockStartggService {
  players: { [id: number]: GgPlayer[] } = {};
  sets: { [id: number]: GgSet[] } = {};

  getPlayers(eventId: number) {
    return of(this.players[eventId] || []);
  }
  getSets(eventId: number) {
    return of(this.sets[eventId] || []);
  }
}

describe('PowerRankingService', () => {
  let service: PowerRankingService;
  let mock: MockStartggService;

  beforeEach(() => {
    mock = new MockStartggService();
    TestBed.configureTestingModule({
      providers: [
        PowerRankingService,
        { provide: StartggService, useValue: mock }
      ]
    });
    service = TestBed.inject(PowerRankingService);
  });

  it('computes simple rankings', async () => {
    mock.players[1] = [
      { id: 1, tag: 'A' },
      { id: 2, tag: 'B' }
    ];
    mock.sets[1] = [
      { id: '1', winnerId: 1, entrantIds: [1, 2] }
    ];
    const records = await service.computeSeason([1]);
    expect(records.length).toBe(2);
    expect(records[0].id).toBe(1);
    expect(records[0].wins).toBe(1);
    expect(records[1].losses).toBe(1);
    expect(records[0].headToHead[2].wins).toBe(1);
    expect(records[1].headToHead[1].losses).toBe(1);
  });
});
