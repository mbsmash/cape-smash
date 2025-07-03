import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GgPlayer, GgSet } from 'src/models/startgg';
import { StartggService } from './startgg.service';

export interface PlayerRecord {
  id: number;
  tag: string;
  wins: number;
  losses: number;
  appearances: number;
  headToHead: { [opponentId: number]: { wins: number; losses: number } };
}

@Injectable({
  providedIn: 'root'
})
export class PowerRankingService {
  private records = new Map<number, PlayerRecord>();

  constructor(private startgg: StartggService) {}

  getRecord(id: number): PlayerRecord | undefined {
    return this.records.get(id);
  }

  getRecords(): PlayerRecord[] {
    return Array.from(this.records.values()).sort((a, b) => {
      const awr = a.wins / Math.max(1, a.wins + a.losses);
      const bwr = b.wins / Math.max(1, b.wins + b.losses);
      if (awr === bwr) return b.wins - a.wins;
      return bwr - awr;
    });
  }

  async computeSeason(eventIds: number[]): Promise<PlayerRecord[]> {
    this.records.clear();
    for (const id of eventIds) {
      const players = await firstValueFrom(this.startgg.getPlayers(id));
      const sets = await firstValueFrom(this.startgg.getSets(id));
      players.forEach(p => this.ensureRecord(p));
      this.processSets(sets);
      players.forEach(p => {
        const rec = this.records.get(p.id)!;
        rec.appearances++;
      });
    }
    return this.getRecords();
  }

  private ensureRecord(p: GgPlayer): void {
    if (!this.records.has(p.id)) {
      this.records.set(p.id, {
        id: p.id,
        tag: p.tag,
        wins: 0,
        losses: 0,
        appearances: 0,
        headToHead: {}
      });
    }
  }

  private processSets(sets: GgSet[]): void {
    for (const s of sets) {
      if (s.entrantIds.length < 2) continue;
      const [p1, p2] = s.entrantIds;
      const winner = s.winnerId;
      const loser = winner === p1 ? p2 : p1;
      const wRec = this.records.get(winner)!;
      const lRec = this.records.get(loser)!;
      wRec.wins++;
      lRec.losses++;
      this.updateH2h(wRec, loser, true);
      this.updateH2h(lRec, winner, false);
    }
  }

  private updateH2h(rec: PlayerRecord, oppId: number, win: boolean): void {
    if (!rec.headToHead[oppId]) {
      rec.headToHead[oppId] = { wins: 0, losses: 0 };
    }
    if (win) {
      rec.headToHead[oppId].wins++;
    } else {
      rec.headToHead[oppId].losses++;
    }
  }
}
