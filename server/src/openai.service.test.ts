import OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from './config.js';
import { OpenAIService, parseModelReport } from './services/openai.service.js';
import { StoneAnalysisReport } from './models/stone-analysis.schema.js';

const validReport: StoneAnalysisReport = {
  identification: { name: 'Quarz', category: 'Mineral', confidence: 'medium', reasoning: 'Einige sichtbare Merkmale passen zu Quarz.' },
  summary: 'Vorsichtige Bildhypothese.', visibleFeatures: ['helle Kristallfläche'], geologicalContext: 'Quarz kommt in vielen Gesteinen vor.',
  alternatives: ['Calcit'], recommendedTests: ['Härte prüfen'], limitations: ['Keine sichere Bestimmung per Foto.']
};
const config = loadConfig({ NODE_ENV: 'test', ANALYSIS_MODE: 'live', OPENAI_API_KEY: 'sk-fake-unit-test' } as NodeJS.ProcessEnv);

describe('OpenAI service response validation', () => {
  it('parses valid structured JSON', () => {
    expect(parseModelReport(JSON.stringify(validReport))).toEqual(validReport);
  });

  it('rejects invalid JSON and invalid schema data as HTTP 502 errors', () => {
    expect(() => parseModelReport('{broken')).toThrow(/gültige strukturierte Antwort/);
    expect(() => parseModelReport(JSON.stringify({ ...validReport, identification: { ...validReport.identification, confidence: 'certain' } }))).toThrow(/Analyseformat/);
  });

  it('sends one base64 image and user notes through Responses with strict JSON Schema', async () => {
    const create = vi.fn().mockResolvedValue({ output_text: JSON.stringify(validReport) });
    const fakeClient = { responses: { create } } as unknown as OpenAI;
    const service = new OpenAIService(config, fakeClient);
    const result = await service.analyze(Buffer.from('photo'), 'image/jpeg', { notes: 'Glimmert' });
    expect(result).toEqual(validReport);
    const payload = create.mock.calls[0][0];
    expect(payload.model).toBe('gpt-4.1-mini');
    expect(payload.text.format).toMatchObject({ type: 'json_schema', strict: true, name: 'stone_analysis' });
    expect(payload.input[0].content[0]).toMatchObject({ type: 'input_text', text: expect.stringContaining('Glimmert') });
    expect(payload.input[0].content[1]).toMatchObject({ type: 'input_image', image_url: `data:image/jpeg;base64,${Buffer.from('photo').toString('base64')}` });
  });

  it('maps OpenAI timeouts to 504 without exposing provider error details', async () => {
    const timeout = Object.assign(new Error('secret provider body'), { name: 'APIConnectionTimeoutError' });
    const fakeClient = { responses: { create: vi.fn().mockRejectedValue(timeout) } } as unknown as OpenAI;
    const service = new OpenAIService(config, fakeClient);
    await expect(service.analyze(Buffer.from('photo'), 'image/png', {})).rejects.toMatchObject({ statusCode: 504, message: expect.not.stringContaining('secret') });
  });
});

describe('backend configuration', () => {
  it('requires an API key only when live mode is selected', () => {
    expect(loadConfig({ ANALYSIS_MODE: 'mock' } as NodeJS.ProcessEnv).ANALYSIS_MODE).toBe('mock');
    expect(() => loadConfig({ ANALYSIS_MODE: 'live' } as NodeJS.ProcessEnv)).toThrow(/OPENAI_API_KEY fehlt/);
  });
});
