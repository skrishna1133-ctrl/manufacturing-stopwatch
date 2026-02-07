import Dexie, { type EntityTable } from 'dexie';

export interface Session {
  id?: number;
  name: string;
  startTime: number;
  endTime?: number;
  totalLaps: number;
  createdAt: number;
}

export interface LapRecord {
  id?: number;
  sessionId: number;
  lapNumber: number;
  lapTime: number;
  cumulativeTime: number;
  note: string;
  timestamp: number;
}

class StopwatchDatabase extends Dexie {
  sessions!: EntityTable<Session, 'id'>;
  laps!: EntityTable<LapRecord, 'id'>;

  constructor() {
    super('StopwatchDB');
    this.version(1).stores({
      sessions: '++id, createdAt, startTime',
      laps: '++id, sessionId, lapNumber, timestamp'
    });
  }
}

export const db = new StopwatchDatabase();
