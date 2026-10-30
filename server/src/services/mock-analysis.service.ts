import { AnalysisFields } from '../models/stone-analysis.schema.js';
import { StoneAnalysisReport } from '../models/stone-analysis.schema.js';
import { StoneAnalyzer } from './openai.service.js';

export class MockAnalysisService implements StoneAnalyzer {
  async analyze(_image: Buffer, _mimeType: 'image/jpeg' | 'image/png' | 'image/webp', _fields: AnalysisFields): Promise<StoneAnalysisReport> {
    return {
      identification: { name: 'Unbekannt (Mock)', category: 'Unbekannt', confidence: 'low', reasoning: 'Der Server ist im Mock-Modus und wertet das Bild nicht aus.' },
      summary: 'Dies ist eine Testantwort des Backend-Mock-Modus. Es wurde keine KI-Anfrage gesendet.',
      visibleFeatures: [], geologicalContext: 'Im Mock-Modus wird kein geologischer Kontext aus dem Bild abgeleitet.',
      alternatives: [], recommendedTests: ['Aktiviere Live-Modus nur, wenn du bewusst eine kostenpflichtige Analyse auslösen möchtest.'],
      limitations: ['Mock-Antwort ohne Bildauswertung.']
    };
  }
}
