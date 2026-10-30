import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { StoneAnalyzer } from './services/openai.service.js';
import { StoneAnalysisReport } from './models/stone-analysis.schema.js';
import { AppError } from './utils/app-error.js';

const report: StoneAnalysisReport = {
  identification: { name: 'Quarz', category: 'Mineral', confidence: 'medium', reasoning: 'Die sichtbare Form könnte zu Quarz passen.' },
  summary: 'Vorsichtige visuelle Einschätzung.', visibleFeatures: ['helle Fläche'], geologicalContext: 'Quarz ist häufig.',
  alternatives: ['Calcit'], recommendedTests: ['Härte prüfen'], limitations: ['Foto erlaubt keine sichere Bestimmung.']
};
const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
const defaultEnv = { NODE_ENV: 'test', ANALYSIS_MODE: 'live', OPENAI_API_KEY: 'sk-test-key' };
const makeApp = (analyzer: StoneAnalyzer, extraEnv: Record<string, string> = {}) => createApp(loadConfig({ ...defaultEnv, ...extraEnv } as NodeJS.ProcessEnv), analyzer);

afterEach(() => vi.restoreAllMocks());

describe('Stone Analyzer API', () => {
  it('returns a health status without configuration details', async () => {
    const response = await request(makeApp({ analyze: vi.fn(), analyzeExtended: vi.fn() })).get('/api/health').expect(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('rejects a missing image and overlong user input', async () => {
    const analyzer = { analyze: vi.fn().mockResolvedValue(report), analyzeExtended: vi.fn().mockResolvedValue(report) };
    await request(makeApp(analyzer)).post('/api/analyze').field('notes', 'x'.repeat(1201)).expect(400);
    expect(analyzer.analyze).not.toHaveBeenCalled();
    await request(makeApp(analyzer)).post('/api/analyze').expect(400);
  });

  it('checks the actual image signature instead of trusting the multipart MIME type', async () => {
    const analyzer = { analyze: vi.fn().mockResolvedValue(report), analyzeExtended: vi.fn().mockResolvedValue(report) };
    await request(makeApp(analyzer)).post('/api/analyze').attach('image', Buffer.from('not an image'), { filename: 'fake.png', contentType: 'image/png' }).expect(415);
    expect(analyzer.analyze).not.toHaveBeenCalled();
  });

  it('validates a JPEG, forwards normalized optional fields, and returns a validated report', async () => {
    const analyzer = { analyze: vi.fn().mockResolvedValue(report), analyzeExtended: vi.fn().mockResolvedValue(report) };
    const response = await request(makeApp(analyzer)).post('/api/analyze')
      .field('location', '  Harz  ').field('color', 'violett').field('size', '4 cm').field('notes', 'Kristall')
      .attach('image', Buffer.from([0xff, 0xd8, 0xff, 0xdb]), { filename: 'fund.jpg', contentType: 'image/jpeg' }).expect(200);
    expect(analyzer.analyze).toHaveBeenCalledWith(expect.any(Buffer), 'image/jpeg', { location: 'Harz', color: 'violett', size: '4 cm', notes: 'Kristall' });
    expect(response.body).toEqual(report);
  });

  it('returns 413 when the configured upload size is exceeded', async () => {
    const analyzer = { analyze: vi.fn().mockResolvedValue(report), analyzeExtended: vi.fn().mockResolvedValue(report) };
    await request(makeApp(analyzer, { MAX_IMAGE_SIZE_MB: '0.000005' })).post('/api/analyze')
      .attach('image', Buffer.concat([png, Buffer.alloc(32)]), { filename: 'large.png', contentType: 'image/png' }).expect(413);
  });

  it('rate limits analysis calls with HTTP 429', async () => {
    const analyzer = { analyze: vi.fn().mockResolvedValue(report), analyzeExtended: vi.fn().mockResolvedValue(report) };
    const app = makeApp(analyzer, { RATE_LIMIT_MAX_REQUESTS: '1' });
    const first = await request(app).post('/api/analyze').attach('image', png, { filename: 'stone.png', contentType: 'image/png' });
    expect(first.status).toBe(200);
    const second = await request(app).post('/api/analyze').attach('image', png, { filename: 'stone.png', contentType: 'image/png' });
    expect(second.status).toBe(429);
    expect(analyzer.analyze).toHaveBeenCalledTimes(1);
  });

  it('returns controlled error messages without forwarding provider details', async () => {
    const analyzer = { analyze: vi.fn().mockRejectedValue(new AppError(503, 'Der KI-Dienst ist vorübergehend nicht verfügbar.', 'openai_unavailable')), analyzeExtended: vi.fn().mockResolvedValue(report) };
    const response = await request(makeApp(analyzer)).post('/api/analyze').attach('image', png, { filename: 'stone.png', contentType: 'image/png' }).expect(503);
    expect(response.body.error.message).toBe('Der KI-Dienst ist vorübergehend nicht verfügbar.');
    expect(JSON.stringify(response.body)).not.toContain('sk-test-key');
  });
});
