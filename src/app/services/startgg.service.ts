import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, delay, switchMap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { 
  GgTournament, 
  GgSet, 
  GgPlayer,
  ImportRequest,
  ImportResult,
  TournamentData
} from '../../models/startgg';

@Injectable({
  providedIn: 'root'
})
export class StartggService {
  private readonly apiUrl = 'https://api.start.gg/gql/alpha';
  private readonly headers: HttpHeaders;

  constructor(private http: HttpClient) {
    this.headers = new HttpHeaders({
      'Authorization': `Bearer ${environment.startggApiToken}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Import tournament data from start.gg URL
   */
  importTournament(request: ImportRequest): Observable<ImportResult> {
    const slug = this.extractSlugFromUrl(request.tournamentUrl);
    
    if (!slug) {
      return of({
        success: false,
        message: 'Invalid start.gg URL format',
        errors: ['URL should be in format: start.gg/tournament/tournament-name']
      });
    }

    return this.getTournamentData(slug).pipe(
      switchMap((tournamentData) => {
        if (!tournamentData) {
          return of({
            success: false,
            message: 'Tournament not found',
            errors: ['Could not retrieve tournament data from start.gg']
          });
        }

        return this.processAndAnalyzeTournament(tournamentData, request);
      }),
      catchError((error) => {
        console.error('Error importing tournament:', error);
        return of({
          success: false,
          message: 'Failed to import tournament',
          errors: [error.message || 'Unknown error occurred']
        });
      })
    );
  }

  /**
   * Get basic tournament information
   */
  private getTournamentData(slug: string): Observable<any> {
    const query = `
      query TournamentQuery($slug: String!) {
        tournament(slug: $slug) {
          id
          name
          slug
          startAt
          endAt
          numAttendees
          events {
            id
            name
            numEntrants
            startAt
            state
            videogame {
              id
              name
            }
            phases {
              id
              name
              numSeeds
            }
          }
        }
      }
    `;

    return this.http.post(this.apiUrl, {
      query,
      variables: { slug }
    }, { headers: this.headers }).pipe(
      map((response: any) => response.data?.tournament),
      delay(100) // Rate limiting
    );
  }

  getTournamentEvents(slug: string): Observable<number[]> {
    const query = `query TournamentEvents($slug: String!) {\n  tournament(slug: $slug) {\n    events {\n      id\n      name\n    }\n  }\n}`;
    return this.post(query, { slug }).pipe(
      map(res => res.data.tournament.events.map((e: any) => Number(e.id)))
    );
  }

  getPlayers(eventId: number): Observable<GgPlayer[]> {
    const query = `query EventPlayers($eventId: ID!) {\n  event(id: $eventId) {\n    entrants(query: {page: 1, perPage: 50}) {\n      nodes {\n        id\n        participants {\n          gamerTag\n          user {\n            id\n          }\n        }\n      }\n    }\n  }\n}`;
    return this.post(query, { eventId }).pipe(
      map(res => this.mapPlayers(res))
    );
  }

  getSets(eventId: number): Observable<GgSet[]> {
    const query = `query EventSets($eventId: ID!) {
  event(id: $eventId) {
    sets(page: 1, perPage: 50) {
      nodes {
        id
        winnerId
        round
        identifier
        fullRoundText
        displayScore
        totalGames
        completedAt
        slots {
          entrant { 
            id
            participants {
              gamerTag
            }
          }
        }
      }
    }
  }
}`;
    return this.post(query, { eventId }).pipe(
      map(res => this.mapSets(res))
    );
  }

  // exposed for unit testing
  mapTournament(response: any): GgTournament {
    const t = response.data.tournament;
    return { id: Number(t.id), name: t.name, slug: t.slug };
  }

  // exposed for unit testing
  mapPlayers(response: any): GgPlayer[] {
    const nodes = response.data.event.entrants.nodes as any[];
    return nodes.map(n => ({ 
      id: Number(n.id), 
      tag: n.participants[0].gamerTag,
      userId: n.participants[0].user?.id ? Number(n.participants[0].user.id) : undefined
    }));
  }

  // exposed for unit testing
  mapSets(response: any): GgSet[] {
    const nodes = response.data.event.sets.nodes as any[];
    
    return nodes.map((n, index) => {
      const entrantNames = n.slots.map((s: any, slotIndex: number) => {
        const participants = s.entrant.participants || [];
        // Try to find a participant with a valid gamerTag
        for (const participant of participants) {
          if (participant.gamerTag && typeof participant.gamerTag === 'string' && !/^\d+$/.test(participant.gamerTag)) {
            return participant.gamerTag;
          }
        }
        // If no valid gamerTag found, return undefined to let the fallback logic handle it
        return undefined;
      });
      
      return {
        id: n.id,
        winnerId: Number(n.winnerId),
        entrantIds: n.slots.map((s: any) => Number(s.entrant.id)),
        entrantNames: entrantNames,
        round: n.round || undefined,
        identifier: n.identifier || undefined,
        fullRoundText: n.fullRoundText || undefined,
        displayScore: n.displayScore || undefined,
        totalGames: n.totalGames || undefined,
        completedAt: n.completedAt || undefined
      };
    });
  }

  /**
   * Extract tournament slug from start.gg URL
   */
  private extractSlugFromUrl(url: string): string | null {
    try {
      // Handle different URL formats
      const patterns = [
        /start\.gg\/tournament\/([^\/\?]+)/,  // start.gg/tournament/slug
        /smash\.gg\/tournament\/([^\/\?]+)/,  // smash.gg/tournament/slug (legacy)
        /start\.gg\/([^\/\?]+)$/              // start.gg/slug (direct format)
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }

      return null;
    } catch (error) {
      console.error('Error extracting slug from URL:', error);
      return null;
    }
  }

  /**
   * Process and analyze tournament data
   */
  private processAndAnalyzeTournament(tournamentData: any, request: ImportRequest): Observable<ImportResult> {
    try {
      // Calculate player count from tournament data
      let playerCount = 0;
      if (tournamentData.numAttendees) {
        // Use tournament-level attendee count if available (most reliable)
        playerCount = tournamentData.numAttendees;
      } else if (tournamentData.events && tournamentData.events.length > 0) {
        // Fallback: sum up entrants from all events (may have duplicates)
        playerCount = tournamentData.events.reduce((total: number, event: any) => {
          return total + (event.numEntrants || 0);
        }, 0);
      }

      // Process events from tournament data
      const processedEvents = (tournamentData.events || []).map((event: any) => ({
        id: event.id,
        name: event.name,
        numEntrants: event.numEntrants || 0,
        startAt: event.startAt,
        endAt: event.endAt,
        sets: [],
        placement: []
      }));

      // Fetch real player data from tournament events
      if (processedEvents.length > 0) {
        // Find the event with the most entrants (main event)
        const mainEvent = processedEvents.reduce((prev: any, current: any) => 
          (current.numEntrants > prev.numEntrants) ? current : prev
        );
        
        if (mainEvent.numEntrants > 0) {
          return this.getPlayers(mainEvent.id).pipe(
            map((players: GgPlayer[]) => {
              // Convert real start.gg players to PlayerPerformance format
              const realPlayers = players.map((player, index) => ({
                id: player.id,
                tag: player.tag,
                userId: player.userId,
                events: [{
                  eventId: mainEvent.id,
                  eventName: mainEvent.name,
                  placement: index + 1, // Placeholder placement
                  totalEntrants: mainEvent.numEntrants,
                  sets: [],
                  stats: {
                    setsWon: 0,
                    setsLost: 0,
                    gamesWon: 0,
                    gamesLost: 0,
                    winRate: 0,
                    gameWinRate: 0,
                    upsets: 0,
                    badLosses: 0,
                    averagePlacement: index + 1,
                    bestPlacement: index + 1,
                    worstPlacement: index + 1
                  }
                }],
                overallStats: {
                  setsWon: 0,
                  setsLost: 0,
                  gamesWon: 0,
                  gamesLost: 0,
                  winRate: 0,
                  gameWinRate: 0,
                  upsets: 0,
                  badLosses: 0,
                  averagePlacement: index + 1,
                  bestPlacement: index + 1,
                  worstPlacement: index + 1
                },
                skillRating: 1000, // Default neutral rating
                consistency: 0.5,
                upsetPotential: 0.1
              }));

              const result: ImportResult = {
                success: true,
                message: `Tournament data retrieved successfully with ${realPlayers.length} real players`,
                data: {
                  tournament: this.mapTournament({ data: { tournament: tournamentData } }),
                  events: processedEvents,
                  players: realPlayers,
                  headToHeadMatrix: [],
                  skillRatings: [],
                  importedAt: new Date(),
                  eventCount: tournamentData.events?.length || 0,
                  playerCount: playerCount // Use the tournament attendee count, not just fetched players
                }
              };

              return result;
            }),
            catchError((playerError) => {
              console.warn('Failed to fetch player data, returning tournament without players:', playerError);
              // Fallback: return tournament data without players but with correct attendee count
              const result: ImportResult = {
                success: true,
                message: 'Tournament data retrieved successfully (player fetch failed)',
                warnings: ['Could not fetch player data from tournament events'],
                data: {
                  tournament: this.mapTournament({ data: { tournament: tournamentData } }),
                  events: processedEvents,
                  players: [],
                  headToHeadMatrix: [],
                  skillRatings: [],
                  importedAt: new Date(),
                  eventCount: tournamentData.events?.length || 0,
                  playerCount: playerCount // Use the tournament attendee count
                }
              };
              return of(result);
            })
          );
        }
      }

      // No events found or no entrants, return tournament data without players
      const result: ImportResult = {
        success: true,
        message: 'Tournament data retrieved successfully (no events with entrants found)',
        data: {
          tournament: this.mapTournament({ data: { tournament: tournamentData } }),
          events: processedEvents,
          players: [],
          headToHeadMatrix: [],
          skillRatings: [],
          importedAt: new Date(),
          eventCount: tournamentData.events?.length || 0,
          playerCount: playerCount // Use the tournament attendee count
        }
      };

      return of(result);
    } catch (error) {
      console.error('Error processing tournament data:', error);
      return of({
        success: false,
        message: 'Failed to process tournament data',
        errors: [error instanceof Error ? error.message : 'Unknown processing error']
      });
    }
  }

  /**
   * Get mock tournament data for testing
   */
  getMockTournamentData(): Observable<ImportResult> {
    const mockPlayers = [
      { id: 1, tag: 'Echo', userId: 1001 },
      { id: 2, tag: 'Hampter', userId: 1002 },
      { id: 3, tag: 'Nodeino', userId: 1003 },
      { id: 4, tag: 'Watr', userId: 1004 },
      { id: 5, tag: 'Kachow', userId: 1005 },
      { id: 6, tag: 'Xpression', userId: 1006 },
      { id: 7, tag: 'Juno', userId: 1007 },
      { id: 8, tag: 'MB', userId: 1008 }
    ];

    return of({
      success: true,
      message: 'Mock tournament data loaded successfully',
      data: {
        tournament: {
          id: 1,
          name: 'Mock Tournament',
          slug: 'mock-tournament'
        },
        events: [{
          id: 1,
          name: 'Mock Event',
          numEntrants: 8,
          startAt: Date.now(),
          sets: [],
          placement: mockPlayers.map((player, index) => ({
            playerId: player.id,
            playerTag: player.tag,
            placement: index + 1
          }))
        }],
        players: mockPlayers.map(player => ({
          id: player.id,
          tag: player.tag,
          userId: player.userId,
          events: [],
          overallStats: {
            setsWon: Math.floor(Math.random() * 10),
            setsLost: Math.floor(Math.random() * 5),
            gamesWon: Math.floor(Math.random() * 30),
            gamesLost: Math.floor(Math.random() * 20),
            winRate: 0.6 + Math.random() * 0.3,
            gameWinRate: 0.65 + Math.random() * 0.25,
            upsets: Math.floor(Math.random() * 3),
            badLosses: Math.floor(Math.random() * 2),
            averagePlacement: 3 + Math.random() * 4,
            bestPlacement: 1 + Math.floor(Math.random() * 3),
            worstPlacement: 5 + Math.floor(Math.random() * 3)
          },
          skillRating: 1000 + Math.random() * 500,
          consistency: 0.5 + Math.random() * 0.4,
          upsetPotential: Math.random() * 0.3
        })),
        headToHeadMatrix: [],
        skillRatings: mockPlayers.map((player, index) => ({
          playerId: player.id,
          playerTag: player.tag,
          rating: 1200 + (8 - index) * 100 + Math.random() * 50,
          confidence: 0.7 + Math.random() * 0.2,
          trend: ['improving', 'stable', 'declining'][Math.floor(Math.random() * 3)] as 'improving' | 'stable' | 'declining',
          recentForm: 1100 + Math.random() * 400,
          peakRating: 1300 + Math.random() * 300,
          rankingPosition: index + 1,
          estimatedSkillRange: { min: 1000 + index * 50, max: 1400 + index * 50 }
        })),
        importedAt: new Date(),
        eventCount: 1,
        playerCount: 8
      }
    }).pipe(delay(1000));
  }

  private post(query: string, variables: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, { query, variables }, { headers: this.headers });
  }
}
