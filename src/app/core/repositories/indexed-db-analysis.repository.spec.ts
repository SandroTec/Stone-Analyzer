import 'fake-indexeddb/auto';
import { IndexedDbAnalysisRepository } from './indexed-db-analysis.repository';
import { StoneAnalysis } from '../../shared/models/stone-analysis.model';

const legacyKey = 'stone-analyzer.analyses.v1';
const sample = (id: string, createdAt: string): StoneAnalysis => ({ id, createdAt, schemaVersion: 1, source: 'demo', identification: { name: 'Pyrit', category: 'Mineral', confidence: 'medium', reasoning: 'Demo' }, summary: 'Demo', visibleFeatures: [], geologicalContext: '', alternatives: [], recommendedTests: [], limitations: [] });

describe('IndexedDbAnalysisRepository', () => {
  let repository: IndexedDbAnalysisRepository;
  beforeEach(() => { localStorage.clear(); repository = new IndexedDbAnalysisRepository(); });
  afterEach(async () => { for (const entry of await repository.getAll()) await repository.delete(entry.id); localStorage.clear(); });

  it('stores reports and original image blobs together, sorts by date, and removes both by ID', async () => {
    const old = sample('old', '2025-01-01T00:00:00Z');
    const latest = sample('latest', '2025-02-01T00:00:00Z');
    const image = new Blob(['original image'], { type: 'image/webp' });
    await repository.save(old);
    await repository.save(latest, image);

    expect((await repository.getAll()).map((entry) => entry.id)).toEqual(['latest', 'old']);
    expect(await repository.getById('old')).toEqual(old);
    expect(await repository.getImage('latest')).toBeInstanceOf(Blob);
    expect(await (await repository.getImage('latest'))?.text()).toBe('original image');
    expect(await repository.getImage('old')).toBeNull();

    await repository.delete('latest');
    expect(await repository.getById('latest')).toBeNull();
    expect(await repository.getImage('latest')).toBeNull();
  });

  it('migrates existing LocalStorage analyses and removes the old copy only after migration', async () => {
    const legacy = sample('legacy', '2025-03-01T00:00:00Z');
    localStorage.setItem(legacyKey, JSON.stringify({ schemaVersion: 1, analyses: [legacy] }));

    expect(await repository.getAll()).toEqual([legacy]);
    expect(localStorage.getItem(legacyKey)).toBeNull();
    expect(await repository.getImage('legacy')).toBeNull();
  });
});
