import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { GgTournament, GgPlayer, GgSet } from 'src/models/startgg';

@Injectable({
  providedIn: 'root'
})
export class StartggService {
  private apiUrl = 'https://api.start.gg/gql/alpha';

  constructor(private http: HttpClient) {}

  private get headers(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${environment.startggApiToken}`
    });
  }

  getTournament(slug: string): Observable<GgTournament> {
    const query = `query Tournament($slug: String!) {\n  tournament(slug: $slug) {\n    id\n    name\n    slug\n  }\n}`;
    return this.post(query, { slug }).pipe(
      map(res => this.mapTournament(res))
    );
  }

  getPlayers(eventId: number): Observable<GgPlayer[]> {
    const query = `query EventPlayers($eventId: ID!) {\n  event(id: $eventId) {\n    entrants(query: {page: 1, perPage: 50}) {\n      nodes {\n        id\n        participants {\n          gamerTag\n        }\n      }\n    }\n  }\n}`;
    return this.post(query, { eventId }).pipe(
      map(res => this.mapPlayers(res))
    );
  }

  getSets(eventId: number): Observable<GgSet[]> {
    const query = `query EventSets($eventId: ID!) {\n  event(id: $eventId) {\n    sets(page: 1, perPage: 50) {\n      nodes {\n        id\n        winnerId\n        slots {\n          entrant { id }\n        }\n      }\n    }\n  }\n}`;
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
    return nodes.map(n => ({ id: Number(n.id), tag: n.participants[0].gamerTag }));
  }

  // exposed for unit testing
  mapSets(response: any): GgSet[] {
    const nodes = response.data.event.sets.nodes as any[];
    return nodes.map(n => ({
      id: n.id,
      winnerId: Number(n.winnerId),
      entrantIds: n.slots.map((s: any) => Number(s.entrant.id))
    }));
  }

  private post(query: string, variables: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, { query, variables }, { headers: this.headers });
  }
}
