import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { StartggService } from './startgg.service';

describe('StartggService', () => {
  let service: StartggService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [StartggService]
    });
    service = TestBed.inject(StartggService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should parse tournament response', () => {
    const mock = { data: { tournament: { id: 5, name: 'Test', slug: 'test' } } };
    expect(service.mapTournament(mock)).toEqual({ id: 5, name: 'Test', slug: 'test' });
  });

  it('should parse players response', () => {
    const mock = {
      data: {
        event: {
          entrants: {
            nodes: [
              { id: '1', participants: [{ gamerTag: 'P1' }] },
              { id: '2', participants: [{ gamerTag: 'P2' }] }
            ]
          }
        }
      }
    };
    expect(service.mapPlayers(mock)).toEqual([
      { id: 1, tag: 'P1' },
      { id: 2, tag: 'P2' }
    ]);
  });

  it('should parse sets response', () => {
    const mock = {
      data: {
        event: {
          sets: {
            nodes: [
              {
                id: '1',
                winnerId: 1,
                slots: [{ entrant: { id: '1' } }, { entrant: { id: '2' } }]
              }
            ]
          }
        }
      }
    };
    expect(service.mapSets(mock)).toEqual([
      { id: '1', winnerId: 1, entrantIds: [1, 2] }
    ]);
  });

  it('should perform http request in getTournament', () => {
    const mockResponse = { data: { tournament: { id: 5, name: 'Test', slug: 'test' } } };
    service.getTournament('test').subscribe(t => {
      expect(t).toEqual({ id: 5, name: 'Test', slug: 'test' });
    });
    const req = httpMock.expectOne('https://api.start.gg/gql/alpha');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });
});
