import { LocalAnalysisRepository } from './local-analysis.repository';
import { StoneAnalysis } from '../../shared/models/stone-analysis.model';

const sample = (id: string, createdAt: string): StoneAnalysis => ({ id, createdAt, schemaVersion: 1, source: 'demo', identification: { name: 'Pyrit', category: 'Mineral', confidence: 'medium' }, summary: 'Demo', visibleFeatures: [], geologicalContext: '', alternatives: [], recommendedTests: [], limitations: [] });

describe('LocalAnalysisRepository', () => {
  const key = 'stone-analyzer.analyses.v1';
  let repository: LocalAnalysisRepository;
  beforeEach(() => { localStorage.clear(); repository = new LocalAnalysisRepository(); });

  it('saves, lists newest first, loads by ID, and deletes analyses', async () => {
    await repository.save(sample('old', '2025-01-01T00:00:00Z'));
    await repository.save(sample('new', '2025-02-01T00:00:00Z'));
    expect((await repository.getAll()).map((item) => item.id)).toEqual(['new', 'old']);
    expect(await repository.getById('old')).toEqual(sample('old', '2025-01-01T00:00:00Z'));
    await repository.delete('new');
    expect((await repository.getAll()).map((item) => item.id)).toEqual(['old']);
  });

  it('clears damaged stored data and returns an empty history', async () => {
    localStorage.setItem(key, '{broken');
    expect(await repository.getAll()).toEqual([]);
    expect(localStorage.getItem(key)).toBeNull();
  });
});
