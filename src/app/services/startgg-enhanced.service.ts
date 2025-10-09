import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError, forkJoin } from 'rxjs';
import { map, catchError, switchMap, delay } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { 
  TournamentData, 
  TournamentEvent, 
  GgTournament, 
  GgSet, 
  PlayerPerformance,
  HeadToHeadRecord,
  SkillRating,
  ImportRequest,
  ImportResult,
  PerformanceStats,
  GgPlayer
} from '../../models/startgg';

@Injectable({
  providedIn: 'root'
})
export class StartggEnhancedService {
  private readonly apiUrl = 'https://api.start.gg/gql/alpha';
  private readonly headers: HttpHeaders;

  constructor(private http: HttpClient) {
    this.headers = new HttpHeaders({
      'Authorization': `Bearer ${environment.startggApiToken}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Import tournament data from start.gg URL or slug
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

  /**
   * Get detailed event sets for analysis
   */
  private getEventSets(eventId: number, page: number = 1, perPage: number = 50): Observable<any> {
    const query = `
      query EventSets($eventId: ID!, $page: Int!, $perPage: Int!) {
        event(id: $eventId) {
          id
          name
          sets(page: $page, perPage: $perPage, sortType: STANDARD) {
            pageInfo {
              total
              totalPages
            }
            nodes {
              id
              fullRoundText
              identifier
              round
              winnerId
              displayScore
              completedAt
              slots {
                entrant {
                  id
                  name
                  participants {
                    id
                    gamerTag
                    user {
                      id
                    }
                  }
                }
              }
              games {
                orderNum
                entrant1Score
                entrant2Score
                selections {
                  entrant {
                    id
                  }
                  character {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    return this.http.post(this.apiUrl, {
      query,
      variables: { eventId, page, perPage }
    }, { headers: this.headers }).pipe(
      map((response: any) => response.data?.event),
      delay(150) // Rate limiting
    );
  }

  /**
   * Get event standings/placements
   */
  private getEventStandings(eventId: number, page: number = 1, perPage: number = 100): Observable<any> {
    const query = `
      query EventStandings($eventId: ID!, $page: Int!, $perPage: Int!) {
        event(id: $eventId) {
          id
          standings(query: {page: $page, perPage: $perPage}) {
            pageInfo {
              total
              totalPages
            }
            nodes {
              placement
              entrant {
                id
                name
                initialSeed
                participants {
                  id
                  gamerTag
                  user {
                    id
                  }
                }
              }
            }
          }
        }
      }
    `;

    return this.http.post(this.apiUrl, {
      query,
      variables: { eventId, page, perPage }
    }, { headers: this.headers }).pipe(
      map((response: any) => response.data?.event),
      delay(150) // Rate limiting
    );
  }

  /**
   * Process and analyze tournament data
   */
  private processAndAnalyzeTournament(tournamentData: any, request: ImportRequest): Observable<ImportResult> {
    const smashEvents = tournamentData.events.filter((event: any) => 
      event.videogame?.name?.toLowerCase().includes('super smash bros')
    );

    if (smashEvents.length === 0) {
      return of({
        success: false,
        message: 'No Super Smash Bros events found in this tournament',
        warnings: ['Only Smash Ultimate events are supported for competition analysis']
      });
    }

    // Process each event
    const eventRequests = smashEvents.map((event: any) => 
      this.processEvent(event.id).pipe(
        catchError(error => {
          console.warn(`Failed to process event ${event.name}:`, error);
          return of(null);
        })
      )
    );

    return forkJoin(eventRequests).pipe(
      map((eventResults: any) => {
        const validEvents = eventResults.filter((event: any) => event !== null);
        
        if (validEvents.length === 0) {
          return {
            success: false,
            message: 'Failed to process any events from the tournament',
            errors: ['Could not retrieve set data from start.gg']
          };
        }

        const processedData = this.compileAnalytics(tournamentData, validEvents);
        
        return {
          success: true,
          message: `Successfully imported ${validEvents.length} event(s) with ${processedData.playerCount} players`,
          data: processedData
        };
      })
    );
  }

  /**
   * Process individual event to extract sets and standings
   */
  private processEvent(eventId: number): Observable<TournamentEvent | null> {
    return forkJoin({
      sets: this.getAllEventSets(eventId),
      standings: this.getEventStandings(eventId)
    }).pipe(
      map(({ sets, standings }) => {
        if (!sets || !standings) {
          return null;
        }

        return {
          id: eventId,
          name: sets.name || `Event ${eventId}`,
          numEntrants: standings.standings?.pageInfo?.total || 0,
          startAt: Date.now(),
          sets: this.processSets(sets.sets?.nodes || []),
          placement: this.processStandings(standings.standings?.nodes || [])
        };
      })
    );
  }

  /**
   * Get all sets from an event (handling pagination)
   */
  private getAllEventSets(eventId: number): Observable<any> {
    return this.getEventSets(eventId, 1, 50).pipe(
      switchMap((firstPage) => {
        const totalPages = firstPage?.sets?.pageInfo?.totalPages || 1;
        
        if (totalPages <= 1) {
          return of(firstPage);
        }

        // Get remaining pages
        const pageRequests = [];
        for (let page = 2; page <= Math.min(totalPages, 10); page++) { // Limit to 10 pages for performance
          pageRequests.push(this.getEventSets(eventId, page, 50));
        }

        return forkJoin([of(firstPage), ...pageRequests]).pipe(
          map((pages) => {
            const allSets = pages.reduce((acc, page) => {
              return acc.concat(page?.sets?.nodes || []);
            }, []);

            return {
              ...firstPage,
              sets: { ...firstPage.sets, nodes: allSets }
            };
          })
        );
      })
    );
  }

  /**
   * Process raw sets data into structured format
   */
  private processSets(rawSets: any[]): GgSet[] {
    return rawSets
      .filter(set => set.completedAt && set.slots && set.slots.length >= 2)
      .map(set => {
        const entrants = set.slots.map((slot: any) => slot.entrant).filter((entrant: any) => entrant);
        
        if (entrants.length < 2) {
          return null; // Skip incomplete sets
        }

        return {
          id: set.id,
          winnerId: set.winnerId,
          entrantIds: entrants.map((entrant: any) => entrant.id),
          entrantNames: entrants.map((entrant: any) => 
            entrant.participants?.[0]?.gamerTag || entrant.name
          ),
          round: set.round,
          identifier: set.identifier,
          fullRoundText: set.fullRoundText,
          displayScore: set.displayScore,
          totalGames: set.games?.length || 0,
          games: set.games,
          completedAt: set.completedAt
        };
      })
      .filter(set => set !== null) as GgSet[]; // Remove null entries and assert type
  }

  /**
   * Process standings data
   */
  private processStandings(rawStandings: any[]) {
    return rawStandings.map(standing => ({
      playerId: standing.entrant.participants?.[0]?.id || standing.entrant.id,
      playerTag: standing.entrant.participants?.[0]?.gamerTag || standing.entrant.name,
      placement: standing.placement,
      seed: standing.entrant.initialSeed
    }));
  }

  /**
   * Compile comprehensive analytics from event data
   */
  private compileAnalytics(tournamentData: any, events: TournamentEvent[]): TournamentData {
    const allSets = events.flatMap(event => event.sets);
    const playerMap = new Map<number, PlayerPerformance>();
    
    // Build player performance data
    events.forEach(event => {
      event.sets.forEach(set => {
        set.entrantIds.forEach((entrantId, index) => {
          if (!playerMap.has(entrantId)) {
            playerMap.set(entrantId, {
              id: entrantId,
              tag: set.entrantNames![index],
              events: [],
              overallStats: this.initializeStats(),
              skillRating: 1000,
              consistency: 0,
              upsetPotential: 0
            });
          }
        });
      });
    });

    // Calculate detailed statistics
    const players = Array.from(playerMap.values());
    this.calculatePlayerStats(players, events);
    const headToHead = this.calculateHeadToHead(allSets);
    const skillRatings = this.calculateSkillRatings(players, events);

    return {
      tournament: {
        id: tournamentData.id,
        name: tournamentData.name,
        slug: tournamentData.slug
      },
      events,
      players,
      headToHeadMatrix: headToHead,
      skillRatings,
      importedAt: new Date(),
      eventCount: events.length,
      playerCount: players.length
    };
  }

  /**
   * Calculate head-to-head records between all players
   */
  private calculateHeadToHead(sets: GgSet[]): HeadToHeadRecord[] {
    const records = new Map<string, HeadToHeadRecord>();

    sets.forEach(set => {
      if (set.entrantIds.length !== 2 || !set.entrantNames) return;

      const [id1, id2] = set.entrantIds;
      const [tag1, tag2] = set.entrantNames;
      const key = `${Math.min(id1, id2)}-${Math.max(id1, id2)}`;

      if (!records.has(key)) {
        records.set(key, {
          player1Id: Math.min(id1, id2),
          player1Tag: id1 < id2 ? tag1 : tag2,
          player2Id: Math.max(id1, id2),
          player2Tag: id1 < id2 ? tag2 : tag1,
          player1Wins: 0,
          player2Wins: 0,
          totalSets: 0,
          gameRecord: { player1Games: 0, player2Games: 0 },
          contexts: []
        });
      }

      const record = records.get(key)!;
      record.totalSets++;

      if (set.winnerId === record.player1Id) {
        record.player1Wins++;
      } else {
        record.player2Wins++;
      }

      // Add context
      record.contexts.push({
        eventName: 'Tournament Event',
        round: set.fullRoundText || 'Unknown Round',
        date: new Date(set.completedAt! * 1000),
        winner: set.winnerId === record.player1Id ? 'player1' : 'player2',
        score: set.displayScore || 'Unknown Score'
      });
    });

    return Array.from(records.values()).filter(record => record.totalSets > 0);
  }

  /**
   * Calculate skill ratings using a simplified ELO-like system
   */
  private calculateSkillRatings(players: PlayerPerformance[], events: TournamentEvent[]): SkillRating[] {
    const ratings = new Map<number, number>();
    
    // Initialize all players at 1000 rating
    players.forEach(player => {
      ratings.set(player.id, 1000);
    });

    // Process sets chronologically to update ratings
    const allSets = events
      .flatMap(event => event.sets)
      .sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));

    allSets.forEach(set => {
      if (set.entrantIds.length === 2) {
        const [player1Id, player2Id] = set.entrantIds;
        const rating1 = ratings.get(player1Id) || 1000;
        const rating2 = ratings.get(player2Id) || 1000;
        
        const expected1 = 1 / (1 + Math.pow(10, (rating2 - rating1) / 400));
        const expected2 = 1 - expected1;
        
        const actual1 = set.winnerId === player1Id ? 1 : 0;
        const actual2 = 1 - actual1;
        
        const k = 32; // K-factor
        const newRating1 = rating1 + k * (actual1 - expected1);
        const newRating2 = rating2 + k * (actual2 - expected2);
        
        ratings.set(player1Id, newRating1);
        ratings.set(player2Id, newRating2);
      }
    });

    return players.map((player, index) => ({
      playerId: player.id,
      playerTag: player.tag,
      rating: Math.round(ratings.get(player.id) || 1000),
      confidence: Math.min(player.overallStats.setsWon + player.overallStats.setsLost, 10) / 10,
      trend: 'stable' as const,
      recentForm: Math.round(ratings.get(player.id) || 1000),
      peakRating: Math.round(ratings.get(player.id) || 1000),
      rankingPosition: index + 1,
      estimatedSkillRange: {
        min: Math.round((ratings.get(player.id) || 1000) - 100),
        max: Math.round((ratings.get(player.id) || 1000) + 100)
      }
    })).sort((a, b) => b.rating - a.rating);
  }

  /**
   * Calculate detailed player statistics
   */
  private calculatePlayerStats(players: PlayerPerformance[], events: TournamentEvent[]): void {
    players.forEach(player => {
      const playerSets = events.flatMap(event => 
        event.sets.filter(set => set.entrantIds.includes(player.id))
      );

      const stats = this.initializeStats();
      
      playerSets.forEach(set => {
        const isWinner = set.winnerId === player.id;
        if (isWinner) {
          stats.setsWon++;
        } else {
          stats.setsLost++;
        }
        
        // Add game counts if available
        if (set.games) {
          set.games.forEach(game => {
            const playerIndex = set.entrantIds.indexOf(player.id);
            if (playerIndex === 0) {
              stats.gamesWon += game.entrant1Score || 0;
              stats.gamesLost += game.entrant2Score || 0;
            } else {
              stats.gamesWon += game.entrant2Score || 0;
              stats.gamesLost += game.entrant1Score || 0;
            }
          });
        }
      });

      stats.winRate = stats.setsWon / (stats.setsWon + stats.setsLost) || 0;
      stats.gameWinRate = stats.gamesWon / (stats.gamesWon + stats.gamesLost) || 0;

      player.overallStats = stats;
    });
  }

  private initializeStats(): PerformanceStats {
    return {
      setsWon: 0,
      setsLost: 0,
      gamesWon: 0,
      gamesLost: 0,
      winRate: 0,
      gameWinRate: 0,
      upsets: 0,
      badLosses: 0,
      averagePlacement: 0,
      bestPlacement: 999,
      worstPlacement: 1
    };
  }

  /**
   * Extract tournament slug from start.gg URL or return slug if already provided
   */
  private extractSlugFromUrl(url: string): string | null {
    // If it's already just a slug (no URL structure), return it
    if (!url.includes('/') && !url.includes('.')) {
      return url;
    }

    const patterns = [
      /start\.gg\/tournament\/([^/?]+)/i,
      /start\.gg\/([^/?]+)/i,
      /smash\.gg\/tournament\/([^/?]+)/i,
      /smash\.gg\/([^/?]+)/i
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Get cached tournament data (for development/testing)
   */
  getMockTournamentData(): Observable<ImportResult> {
    // Mock data for testing when API is not available
    return of({
      success: true,
      message: 'Mock tournament data loaded',
      data: {
        tournament: { id: 1, name: 'Mock Tournament', slug: 'mock-tournament' },
        events: [],
        players: [],
        headToHeadMatrix: [],
        skillRatings: [],
        importedAt: new Date(),
        eventCount: 1,
        playerCount: 8
      }
    }).pipe(delay(1000));
  }

  // Legacy methods for backward compatibility
  getTournament(slug: string): Observable<GgTournament> {
    return this.getTournamentData(slug).pipe(
      map(data => ({
        id: data.id,
        name: data.name,
        slug: data.slug
      }))
    );
  }

  getPlayers(eventId: number): Observable<GgPlayer[]> {
    return this.getEventStandings(eventId).pipe(
      map(data => data.standings?.nodes?.map((standing: any) => ({
        id: standing.entrant.participants?.[0]?.id || standing.entrant.id,
        tag: standing.entrant.participants?.[0]?.gamerTag || standing.entrant.name,
        userId: standing.entrant.participants?.[0]?.user?.id
      })) || [])
    );
  }

  getSets(eventId: number): Observable<GgSet[]> {
    return this.getEventSets(eventId).pipe(
      map(data => this.processSets(data.sets?.nodes || []))
    );
  }
}
