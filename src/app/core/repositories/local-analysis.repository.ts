import { Injectable } from '@angular/core';
import { AnalysisRepository } from './analysis.repository';
import { StoneAnalysis } from '../../shared/models/stone-analysis.model';

interface StoredAnalyses { schemaVersion: 1; analyses: StoneAnalysis[]; }

function isAnalysis(value: unknown): value is StoneAnalysis {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<StoneAnalysis>;
  return typeof item.id === 'string'
    && typeof item.createdAt === 'string'
    && item.schemaVersion === 1
    && (item.source === 'demo' || item.source === 'ai')
    && typeof item.identification === 'object'
    && item.identification !== null
    && typeof item.identification.name === 'string'
    && typeof item.identification.reasoning === 'string'
    && (item.identification.category === 'Mineral' || item.identification.category === 'Gestein' || item.identification.category === 'Unbekannt')
    && ['low', 'medium', 'high'].includes(item.identification.confidence)
    && typeof item.summary === 'string'
    && Array.isArray(item.visibleFeatures)
    && typeof item.geologicalContext === 'string'
    && Array.isArray(item.alternatives)
    && Array.isArray(item.recommendedTests)
    && Array.isArray(item.limitations);
}

@Injectable({ providedIn: 'root' })
export class LocalAnalysisRepository extends AnalysisRepository {
  private readonly key = 'stone-analyzer.analyses.v1';

  async save(analysis: StoneAnalysis): Promise<void> {
    const entries = await this.getAll();
    localStorage.setItem(this.key, JSON.stringify({ schemaVersion: 1, analyses: [analysis, ...entries] } satisfies StoredAnalyses));
  }

  async getAll(): Promise<StoneAnalysis[]> {
    const raw = localStorage.getItem(this.key);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null || !('schemaVersion' in parsed) || !('analyses' in parsed)) throw new Error('Ungültiges Datenformat');
      const data = parsed as StoredAnalyses;
      if (data.schemaVersion !== 1 || !Array.isArray(data.analyses) || !data.analyses.every(isAnalysis)) throw new Error('Nicht unterstützte oder beschädigte Daten');
      return [...data.analyses].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    } catch {
      localStorage.removeItem(this.key);
      return [];
    }
  }

  async getById(id: string): Promise<StoneAnalysis | null> {
    return (await this.getAll()).find((entry) => entry.id === id) ?? null;
  }

  async delete(id: string): Promise<void> {
    const entries = (await this.getAll()).filter((entry) => entry.id !== id);
    localStorage.setItem(this.key, JSON.stringify({ schemaVersion: 1, analyses: entries } satisfies StoredAnalyses));
  }
}
