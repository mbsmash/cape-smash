import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, delay } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { 
  GgTournament, 
  GgSet, 
  GgPlayer
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

  private post(query: string, variables: any): Observable<any> {
    return this.http.post(this.apiUrl, { query, variables }, { headers: this.headers }).pipe(
      delay(100)
    );
  }

  getTournamentEvents(slug: string): Observable<number[]> {
    const query = `query TournamentEvents($slug: String!) {
      tournament(slug: $slug) {
        events {
          id
          name
        }
      }
    }`;
    return this.post(query, { slug }).pipe(
      map(res => res.data.tournament.events.map((e: any) => Number(e.id)))
    );
  }

  getPlayers(eventId: number): Observable<GgPlayer[]> {
    const query = `query EventPlayers($eventId: ID!) {
      event(id: $eventId) {
        entrants(query: {page: 1, perPage: 50}) {
          nodes {
            id
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
    
    return nodes.map((n) => {
      const entrantNames = n.slots.map((s: any) => {
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
}
