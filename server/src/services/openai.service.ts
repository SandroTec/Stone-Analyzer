import OpenAI from 'openai';
import { AppConfig } from '../config.js';
import { StoneAnalysisJsonSchema, StoneAnalysisReport, StoneAnalysisReportSchema, AnalysisFields, ExtendedAnalysisFields } from '../models/stone-analysis.schema.js';
import { stoneAnalysisPrompt } from '../prompts/stone-analysis.prompt.js';
import { AppError } from '../utils/app-error.js';

export interface StoneAnalyzer {
  analyze(image: Buffer, mimeType: 'image/jpeg' | 'image/png' | 'image/webp', fields: AnalysisFields): Promise<StoneAnalysisReport>;
  analyzeExtended(images: { buffer: Buffer; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' }[], fields: ExtendedAnalysisFields, previous: StoneAnalysisReport): Promise<StoneAnalysisReport>;
}

export function parseModelReport(output: string): StoneAnalysisReport {
  let value: unknown;
  try { value = JSON.parse(output); }
  catch { throw new AppError(502, 'Der KI-Dienst hat keine gültige strukturierte Antwort geliefert.', 'invalid_ai_response'); }
  const parsed = StoneAnalysisReportSchema.safeParse(value);
  if (!parsed.success) throw new AppError(502, 'Die Antwort des KI-Dienstes entsprach nicht dem erwarteten Analyseformat.', 'invalid_ai_response');
  return parsed.data;
}

export class OpenAIService implements StoneAnalyzer {
  private readonly client: OpenAI;
  constructor(private readonly config: AppConfig, client?: OpenAI) {
    this.client = client ?? new OpenAI({ apiKey: config.OPENAI_API_KEY, timeout: config.OPENAI_TIMEOUT_MS, maxRetries: 0 });
  }

  async analyze(image: Buffer, mimeType: 'image/jpeg' | 'image/png' | 'image/webp', fields: AnalysisFields): Promise<StoneAnalysisReport> {
    const observations = [
      fields.location ? `Angegebener Fundort (nicht verifiziert): ${fields.location}` : '',
      fields.color ? `Vom Nutzer angegebene Farbe (nicht verifiziert): ${fields.color}` : '',
      fields.size ? `Vom Nutzer angegebene Größe (nicht verifiziert): ${fields.size}` : '',
      fields.notes ? `Weitere Nutzerbeobachtungen (nicht verifiziert): ${fields.notes}` : ''
    ].filter(Boolean).join('\n') || 'Keine zusätzlichen Angaben.';
    let output: string | undefined;
    try {
      const response = await this.client.responses.create({
        model: this.config.OPENAI_MODEL,
        instructions: stoneAnalysisPrompt,
        input: [{ role: 'user', content: [
          { type: 'input_text', text: `Analysiere das angehängte Bild. Ergänzende Angaben (unbestätigt):\n${observations}` },
          { type: 'input_image', image_url: `data:${mimeType};base64,${image.toString('base64')}`, detail: 'high' }
        ] }],
        text: { format: { type: 'json_schema', name: 'stone_analysis', strict: true, schema: StoneAnalysisJsonSchema } }
      });
      output = response.output_text;
    } catch (error) {
      const details = error as { name?: string; status?: number; code?: string };
      if (details.name === 'APIConnectionTimeoutError' || details.name === 'AbortError') {
        throw new AppError(504, 'Die Analyse hat das Zeitlimit überschritten. Bitte versuche es später erneut.', 'openai_timeout');
      }
      if (details.status === 429 || (typeof details.status === 'number' && details.status >= 500) || details.code === 'ECONNRESET' || details.code === 'ENOTFOUND') {
        throw new AppError(503, 'Der KI-Dienst ist vorübergehend nicht verfügbar. Bitte versuche es später erneut.', 'openai_unavailable');
      }
      throw new AppError(502, 'Der KI-Dienst konnte keine Analyse erstellen.', 'openai_request_failed');
    }
    if (!output?.trim()) throw new AppError(502, 'Der KI-Dienst hat keine Analyse zurückgegeben.', 'invalid_ai_response');
    return parseModelReport(output);
  }

  async analyzeExtended(images: { buffer: Buffer; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' }[], fields: ExtendedAnalysisFields, previous: StoneAnalysisReport): Promise<StoneAnalysisReport> {
    const observations = `Fundort: ${fields.location}\nFarbe: ${fields.color}\nGröße: ${fields.size}\nWeitere Beobachtungen: ${fields.notes}`;
    const content: Array<{ type: 'input_text'; text: string } | { type: 'input_image'; image_url: string; detail: 'high' }> = [
      { type: 'input_text', text: `Erstelle eine erweiterte Analyse auf Grundlage der bisherigen Analyse und der ergänzenden Angaben. Die Angaben sind unbestätigt. Das erste angehängte Bild ist das Originalfoto des Fundstücks; alle folgenden Bilder sind zusätzliche Ansichten desselben Fundstücks.\n\nBisheriger Analysebericht:\n${JSON.stringify(previous)}\n\nPflichtangaben:\n${observations}\n\nBilder folgen.` }
    ];
    for (const image of images) content.push({ type: 'input_image', image_url: `data:${image.mimeType};base64,${image.buffer.toString('base64')}`, detail: 'high' });
    let output: string | undefined;
    try {
      const response = await this.client.responses.create({ model: this.config.OPENAI_MODEL, instructions: `${stoneAnalysisPrompt}\n\nDies ist eine erweiterte Analyse. Vergleiche die neuen Bilder mit dem vorherigen Bericht. Korrigiere frühere Hypothesen, wenn die zusätzliche Evidenz es erfordert; behandle Nutzerangaben als unbestätigt.`, input: [{ role: 'user', content }], text: { format: { type: 'json_schema', name: 'stone_analysis', strict: true, schema: StoneAnalysisJsonSchema } } });
      output = response.output_text;
    } catch (error) {
      const details = error as { name?: string; status?: number; code?: string };
      if (details.name === 'APIConnectionTimeoutError' || details.name === 'AbortError') throw new AppError(504, 'Die erweiterte Analyse hat das Zeitlimit überschritten. Bitte versuche es später erneut.', 'openai_timeout');
      if (details.status === 429 || (typeof details.status === 'number' && details.status >= 500) || details.code === 'ECONNRESET' || details.code === 'ENOTFOUND') throw new AppError(503, 'Der KI-Dienst ist vorübergehend nicht verfügbar. Bitte versuche es später erneut.', 'openai_unavailable');
      throw new AppError(502, 'Der KI-Dienst konnte keine erweiterte Analyse erstellen.', 'openai_request_failed');
    }
    if (!output?.trim()) throw new AppError(502, 'Der KI-Dienst hat keine erweiterte Analyse zurückgegeben.', 'invalid_ai_response');
    return parseModelReport(output);
  }
}
