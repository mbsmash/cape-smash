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
    return this.getAllPlayers(eventId, 1, []);
  }

  private getAllPlayers(eventId: number, page: number, accumulatedPlayers: GgPlayer[]): Observable<GgPlayer[]> {
    const query = `query EventPlayers($eventId: ID!, $page: Int!) {
  event(id: $eventId) {
    entrants(query: {page: $page, perPage: 50}) {
      pageInfo {
        totalPages
      }
      nodes {
        id
        name
        standing {
          placement
        }
        participants {
          gamerTag
          user {
            id
          }
        }
      }
    }
  }
}`;
    return this.post(query, { eventId, page }).pipe(
      switchMap(res => {
        const currentPlayers = this.mapPlayers(res);
        const allPlayers = [...accumulatedPlayers, ...currentPlayers];
        const totalPages = res.data?.event?.entrants?.pageInfo?.totalPages || 1;
        
        if (page < totalPages) {
          // Fetch next page recursively
          return this.getAllPlayers(eventId, page + 1, allPlayers).pipe(
            delay(100) // Rate limiting between requests
          );
        } else {
          // Return all accumulated players
          return of(allPlayers);
        }
      })
    );
  }

  getSets(eventId: number): Observable<GgSet[]> {
    return this.getAllSets(eventId, 1, []);
  }

  private getAllSets(eventId: number, page: number, accumulatedSets: GgSet[]): Observable<GgSet[]> {
    console.log(`🎯 Fetching sets for event ${eventId}, page ${page}, accumulated so far: ${accumulatedSets.length}`);
    
    const query = `query EventSets($eventId: ID!, $page: Int!) {
  event(id: $eventId) {
    sets(page: $page, perPage: 50) {
      pageInfo {
        totalPages
        total
        perPage
      }
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
    return this.post(query, { eventId, page }).pipe(
      switchMap(res => {
        console.log(`📦 Raw sets response for page ${page}:`, res);
        
        const currentSets = this.mapSets(res);
        const allSets = [...accumulatedSets, ...currentSets];
        const pageInfo = res.data?.event?.sets?.pageInfo;
        const totalPages = pageInfo?.totalPages || 1;
        const totalSets = pageInfo?.total || 0;
        
        console.log(`📊 Sets fetch stats - Page: ${page}/${totalPages}, Current page sets: ${currentSets.length}, Total accumulated: ${allSets.length}, Expected total: ${totalSets}`);
        
        if (page < totalPages) {
          console.log(`➡️ Fetching next page: ${page + 1}/${totalPages}`);
          // Fetch next page recursively
          return this.getAllSets(eventId, page + 1, allSets).pipe(
            delay(100) // Rate limiting between requests
          );
        } else {
          console.log(`✅ Finished fetching all sets. Final count: ${allSets.length}`);
          // Return all accumulated sets
          return of(allSets);
        }
      })
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
    console.log(`🎯 Mapping ${nodes?.length || 0} players with placement data`);
    
    const players = nodes.map(n => ({ 
      id: Number(n.id), 
      tag: n.participants[0].gamerTag,
      userId: n.participants[0].user?.id ? Number(n.participants[0].user.id) : undefined,
      placement: n.standing?.placement || undefined
    }));
    
    // Log some example placements for debugging
    const playersWithPlacements = players.filter(p => p.placement);
    console.log(`📊 Found ${playersWithPlacements.length} players with placement data:`, 
      playersWithPlacements.slice(0, 5).map(p => `${p.tag}: ${p.placement}`));
    
    return players;
  }

  // exposed for unit testing
  mapSets(response: any): GgSet[] {
    console.log(`🗺️ Mapping sets response:`, response?.data?.event?.sets);
    
    const nodes = response.data.event.sets.nodes as any[];
    console.log(`📦 Raw sets nodes count: ${nodes?.length || 0}`);
    
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
   * Calculate player statistics from sets data
   */
  private calculatePlayerStats(players: GgPlayer[], sets: GgSet[]): Map<number, any> {
    const statsMap = new Map();
    
    // Initialize stats for all players
    players.forEach(player => {
      statsMap.set(player.id, {
        setsWon: 0,
        setsLost: 0,
        gamesWon: 0,
        gamesLost: 0,
        placement: players.length // Default to last place, will be updated
      });
    });

    // Process each set to calculate W/L records
    sets.forEach(set => {
      if (set.winnerId && set.entrantIds.length === 2) {
        const winnerId = set.winnerId;
        const loserId = set.entrantIds.find(id => id !== winnerId);
        
        if (winnerId && loserId) {
          // Update winner stats
          if (statsMap.has(winnerId)) {
            const winnerStats = statsMap.get(winnerId);
            winnerStats.setsWon++;
            // Try to extract game count from displayScore if available
            if (set.displayScore) {
              const gameWins = this.extractGameWins(set.displayScore, true);
              winnerStats.gamesWon += gameWins;
            }
          }
          
          // Update loser stats
          if (statsMap.has(loserId)) {
            const loserStats = statsMap.get(loserId);
            loserStats.setsLost++;
            // Try to extract game count from displayScore if available
            if (set.displayScore) {
              const gameLosses = this.extractGameWins(set.displayScore, false);
              loserStats.gamesLost += gameLosses;
            }
          }
        }
      }
    });

    // Use actual tournament placements instead of calculating from win rate
    players.forEach(player => {
      const stats = statsMap.get(player.id);
      if (stats && player.placement) {
        stats.placement = player.placement;
        console.log(`🏆 Set placement for ${player.tag}: ${player.placement}`);
      } else if (stats) {
        console.log(`⚠️ No placement data for ${player.tag}, keeping default`);
      }
    });

    return statsMap;
  }

  /**
   * Extract game wins from displayScore string
   */
  private extractGameWins(displayScore: string, isWinner: boolean): number {
    if (!displayScore) return 0;
    
    // Try to parse common score formats like "3-1", "2-0", etc.
    const scoreMatch = displayScore.match(/(\d+)\s*-\s*(\d+)/);
    if (scoreMatch) {
      const score1 = parseInt(scoreMatch[1]);
      const score2 = parseInt(scoreMatch[2]);
      
      if (isWinner) {
        return Math.max(score1, score2); // Winner gets the higher score
      } else {
        return Math.min(score1, score2); // Loser gets the lower score
      }
    }
    
    return 0; // Default if we can't parse
  }

  /**
   * Calculate head-to-head matrix from sets data
   */
  private calculateHeadToHead(sets: GgSet[], players: GgPlayer[]): any[] {
    const h2hMap = new Map<string, any>();
    
    sets.forEach(set => {
      if (set.winnerId && set.entrantIds.length === 2) {
        const winnerId = set.winnerId;
        const loserId = set.entrantIds.find(id => id !== winnerId);
        
        if (winnerId && loserId) {
          // Create a consistent key regardless of order
          const key1 = `${Math.min(winnerId, loserId)}-${Math.max(winnerId, loserId)}`;
          
          if (!h2hMap.has(key1)) {
            const player1 = players.find(p => p.id === Math.min(winnerId, loserId));
            const player2 = players.find(p => p.id === Math.max(winnerId, loserId));
            
            h2hMap.set(key1, {
              player1Id: Math.min(winnerId, loserId),
              player1Name: player1?.tag || 'Unknown',
              player2Id: Math.max(winnerId, loserId),
              player2Name: player2?.tag || 'Unknown',
              player1Wins: 0,
              player2Wins: 0,
              totalSets: 0
            });
          }
          
          const record = h2hMap.get(key1);
          if (winnerId === record.player1Id) {
            record.player1Wins++;
          } else {
            record.player2Wins++;
          }
          record.totalSets++;
        }
      }
    });
    
    return Array.from(h2hMap.values()).filter(record => record.totalSets >= 2);
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
          console.log(`🏆 Processing main event: ${mainEvent.name} (ID: ${mainEvent.id}) with ${mainEvent.numEntrants} entrants`);
          
          return this.getPlayers(mainEvent.id).pipe(
            switchMap((players: GgPlayer[]) => {
              console.log(`👥 Fetched ${players.length} players from event ${mainEvent.id}`);
              
              // Also fetch sets data for the main event
              return this.getSets(mainEvent.id).pipe(
                map((sets: GgSet[]) => {
                  console.log(`⚔️ Fetched ${sets.length} sets from event ${mainEvent.id}`);
                  console.log(`📋 First few sets:`, sets.slice(0, 3));
                  
                  // Calculate W/L records from sets data
                  const playerStats = this.calculatePlayerStats(players, sets);
                  console.log(`📊 Calculated stats for ${playerStats.size} players`);
                  
                  // Log some example player stats
                  const statsArray = Array.from(playerStats.entries()).slice(0, 3);
                  console.log(`📈 Sample player stats:`, statsArray);
                  
                  // Convert real start.gg players to PlayerPerformance format with actual stats
                  const realPlayers = players.map((player, index) => {
                    const stats = playerStats.get(player.id) || {
                      setsWon: 0,
                      setsLost: 0,
                      gamesWon: 0,
                      gamesLost: 0,
                      placement: index + 1
                    };
                    
                    const winRate = stats.setsWon + stats.setsLost > 0 ? 
                      stats.setsWon / (stats.setsWon + stats.setsLost) : 0;
                    const gameWinRate = stats.gamesWon + stats.gamesLost > 0 ? 
                      stats.gamesWon / (stats.gamesWon + stats.gamesLost) : 0;
                    
                    // Calculate top 25% rate (whether this placement was in top 25%)
                    const top25Threshold = Math.ceil(mainEvent.numEntrants * 0.25);
                    const isTop25 = stats.placement <= top25Threshold;
                    const top25Rate = isTop25 ? 1.0 : 0.0; // Single tournament, so either 100% or 0%
                    
                    // Calculate consistency rating (0-100 scale)
                    // Based on placement percentile - higher is better
                    const placementPercentile = ((mainEvent.numEntrants - stats.placement + 1) / mainEvent.numEntrants);
                    const consistencyRating = Math.round(placementPercentile * 100);

                    return {
                      id: player.id,
                      tag: player.tag,
                      userId: player.userId,
                      events: [{
                        eventId: mainEvent.id,
                        eventName: mainEvent.name,
                        placement: stats.placement,
                        totalEntrants: mainEvent.numEntrants,
                        sets: sets.filter(set => 
                          set.entrantIds.includes(player.id)
                        ).map(set => ({
                          setId: set.id,
                          opponentId: set.entrantIds.find(id => id !== player.id) || 0,
                          opponentTag: set.entrantNames?.find((name, idx) => 
                            set.entrantIds[idx] !== player.id
                          ) || 'Unknown',
                          result: set.winnerId === player.id ? 'win' : 'loss' as 'win' | 'loss',
                          score: set.displayScore || '',
                          round: set.fullRoundText || set.identifier || `Round ${set.round || '?'}`,
                          gameScore: { wins: 0, losses: 0 } // TODO: Extract from displayScore if needed
                        })),
                        stats: {
                          setsWon: stats.setsWon,
                          setsLost: stats.setsLost,
                          gamesWon: stats.gamesWon,
                          gamesLost: stats.gamesLost,
                          winRate: winRate,
                          gameWinRate: gameWinRate,
                          upsets: 0, // TODO: Calculate based on seeding if available
                          badLosses: 0, // TODO: Calculate based on seeding if available
                          averagePlacement: stats.placement,
                          bestPlacement: stats.placement,
                          worstPlacement: stats.placement,
                          top25Rate: top25Rate,
                          consistencyRating: consistencyRating,
                          tournamentCount: 1
                        }
                      }],
                      overallStats: {
                        setsWon: stats.setsWon,
                        setsLost: stats.setsLost,
                        gamesWon: stats.gamesWon,
                        gamesLost: stats.gamesLost,
                        winRate: winRate,
                        gameWinRate: gameWinRate,
                        upsets: 0,
                        badLosses: 0,
                        averagePlacement: stats.placement,
                        bestPlacement: stats.placement,
                        worstPlacement: stats.placement,
                        top25Rate: top25Rate,
                        consistencyRating: consistencyRating,
                        tournamentCount: 1
                      },
                      skillRating: 1000 + (winRate - 0.5) * 400, // Adjust rating based on performance
                      consistency: Math.min(winRate + 0.1, 1.0),
                      upsetPotential: Math.max(0.1, 1.0 - winRate)
                    };
                  });

                  // Update the event with actual sets data
                  processedEvents[processedEvents.indexOf(mainEvent)].sets = sets;

                  const result: ImportResult = {
                    success: true,
                    message: `Tournament data retrieved successfully with ${realPlayers.length} players and ${sets.length} sets`,
                    data: {
                      tournament: this.mapTournament({ data: { tournament: tournamentData } }),
                      events: processedEvents,
                      players: realPlayers,
                      headToHeadMatrix: this.calculateHeadToHead(sets, players),
                      skillRatings: [],
                      importedAt: new Date(),
                      eventCount: tournamentData.events?.length || 0,
                      playerCount: playerCount
                    }
                  };

                  console.log(`🎉 Final import result:`, {
                    success: result.success,
                    message: result.message,
                    playerCount: result.data?.players.length,
                    setsCount: sets.length,
                    headToHeadCount: result.data?.headToHeadMatrix.length,
                    eventsCount: result.data?.events.length
                  });

                  return result;
                })
              );
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
            worstPlacement: 5 + Math.floor(Math.random() * 3),
            top25Rate: Math.random(), // Random percentage for mock data
            consistencyRating: Math.floor(Math.random() * 100), // 0-100 rating
            tournamentCount: 1 + Math.floor(Math.random() * 5) // 1-5 tournaments
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
