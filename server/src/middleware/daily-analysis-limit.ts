import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

interface DailyUsage {
  day: string;
  used: number;
}

export interface DailyLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
  retryAfterSeconds: number;
}

export class DailyAnalysisLimit {
  private readonly stateFile: string;

  constructor(private readonly limit: number, stateFile: string) {
    this.stateFile = resolve(process.cwd(), stateFile);
  }

  consume(now = new Date()): DailyLimitResult {
    const day = now.toISOString().slice(0, 10);
    const current = this.readUsage(day);
    const retryAfterSeconds = this.secondsUntilUtcMidnight(now);
    if (current.used >= this.limit) return { allowed: false, used: current.used, limit: this.limit, retryAfterSeconds };

    this.persist({ day, used: current.used + 1 });
    return { allowed: true, used: current.used + 1, limit: this.limit, retryAfterSeconds };
  }

  private readUsage(day: string): DailyUsage {
    if (!existsSync(this.stateFile)) return { day, used: 0 };
    const value: unknown = JSON.parse(readFileSync(this.stateFile, 'utf8'));
    if (!value || typeof value !== 'object' || !('day' in value) || !('used' in value)
      || typeof value.day !== 'string' || typeof value.used !== 'number'
      || !Number.isSafeInteger(value.used) || value.used < 0) {
      throw new Error('Daily analysis usage store has an invalid format; refusing KI requests.');
    }
    return value.day === day ? { day, used: value.used } : { day, used: 0 };
  }

  private persist(usage: DailyUsage): void {
    mkdirSync(dirname(this.stateFile), { recursive: true });
    const temporaryFile = `${this.stateFile}.${process.pid}.tmp`;
    writeFileSync(temporaryFile, JSON.stringify(usage), { encoding: 'utf8', mode: 0o600 });
    renameSync(temporaryFile, this.stateFile);
  }

  private secondsUntilUtcMidnight(now: Date): number {
    const nextMidnight = new Date(now);
    nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);
    nextMidnight.setUTCHours(0, 0, 0, 0);
    return Math.max(1, Math.ceil((nextMidnight.getTime() - now.getTime()) / 1000));
  }
}
