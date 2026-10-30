import { TestBed } from '@angular/core/testing';
import { AnalysisRepository } from '../repositories/analysis.repository';
import { StoneAnalysisService } from './stone-analysis.service';

describe('StoneAnalysisService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it('creates a typed demo analysis and persists it', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({ providers: [StoneAnalysisService, { provide: AnalysisRepository, useValue: { save } }] });
    const service = TestBed.inject(StoneAnalysisService);
    const pending = service.analyzeStone({ image: new File(['rock'], 'rock.png', { type: 'image/png' }) });
    await vi.advanceTimersByTimeAsync(1100);
    const result = await pending;
    expect(result.source).toBe('demo');
    expect(['Amethyst', 'Granit', 'Pyrit']).toContain(result.identification.name);
    expect(result.id).toBeTruthy();
    expect(save).toHaveBeenCalledWith(result);
  });
});
