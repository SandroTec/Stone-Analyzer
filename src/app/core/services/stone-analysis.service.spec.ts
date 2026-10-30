import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AnalysisRepository } from '../repositories/analysis.repository';
import { StoneAnalysisService } from './stone-analysis.service';
import { environment } from '../../../environments/environment';

describe('StoneAnalysisService', () => {
  beforeEach(() => { vi.useFakeTimers(); environment.analysisMode = 'mock'; });
  afterEach(() => { vi.useRealTimers(); environment.analysisMode = 'live'; });
  it('creates a typed demo analysis and persists it', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({ providers: [StoneAnalysisService, provideHttpClient(), { provide: AnalysisRepository, useValue: { save } }] });
    const service = TestBed.inject(StoneAnalysisService);
    const pending = service.analyzeStone({ image: new File(['rock'], 'rock.png', { type: 'image/png' }) });
    await vi.advanceTimersByTimeAsync(1100);
    const result = await pending;
    expect(result.source).toBe('demo');
    expect(['Amethyst', 'Granit', 'Pyrit']).toContain(result.identification.name);
    expect(result.id).toBeTruthy();
    expect(save).toHaveBeenCalledWith(result, expect.any(File));
  });
});

describe('StoneAnalysisService live file flow', () => {
  const previousMode = environment.analysisMode;
  let http: HttpTestingController;
  let save: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    environment.analysisMode = 'live';
    save = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({ providers: [StoneAnalysisService, provideHttpClient(), provideHttpClientTesting(), { provide: AnalysisRepository, useValue: { save } }] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { http.verify(); environment.analysisMode = previousMode; });

  it('posts the selected image and observations as FormData, then enriches and stores the report', async () => {
    const service = TestBed.inject(StoneAnalysisService);
    const image = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00])], 'field-sample.jpg', { type: 'image/jpeg' });
    const pending = service.analyzeStone({ image, location: 'Harz', color: 'violett', approximateSize: '4 cm', observations: 'Kristallfläche' });

    const req = http.expectOne('/api/analyze');
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body.get('image')).toMatchObject({ name: 'field-sample.jpg', type: 'image/jpeg', size: 5 });
    expect(body.get('location')).toBe('Harz');
    expect(body.get('color')).toBe('violett');
    expect(body.get('size')).toBe('4 cm');
    expect(body.get('notes')).toBe('Kristallfläche');
    expect(req.request.headers.has('Content-Type')).toBe(false);

    req.flush({
      identification: { name: 'Quarz', category: 'Mineral', confidence: 'medium', reasoning: 'Sichtbare kristalline Fläche.' },
      summary: 'Vorsichtige visuelle Hypothese.', visibleFeatures: ['Kristallfläche'], geologicalContext: 'Quarz ist verbreitet.',
      alternatives: ['Calcit'], recommendedTests: ['Härte prüfen'], limitations: ['Foto erlaubt keine sichere Bestimmung.']
    });
    const result = await pending;
    expect(result.source).toBe('ai');
    expect(result.identification.name).toBe('Quarz');
    expect(result.id).toBeTruthy();
    expect(Number.isNaN(Date.parse(result.createdAt))).toBe(false);
    expect(save).toHaveBeenCalledWith(result, expect.any(File));
  });

  it('does not persist a failed API request', async () => {
    const service = TestBed.inject(StoneAnalysisService);
    const pending = service.analyzeStone({ image: new File(['image'], 'sample.png', { type: 'image/png' }) });
    http.expectOne('/api/analyze').flush({ error: { code: 'openai_unavailable', message: 'Der KI-Dienst ist vorübergehend nicht verfügbar.' } }, { status: 503, statusText: 'Service Unavailable' });
    await expect(pending).rejects.toThrow('Der KI-Dienst ist vorübergehend nicht verfügbar.');
    expect(save).not.toHaveBeenCalled();
  });
});
