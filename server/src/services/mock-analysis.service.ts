import { AnalysisFields, ExtendedAnalysisFields, StoneAnalysisReport } from '../models/stone-analysis.schema.js';
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
  async analyzeExtended(_images: { buffer: Buffer; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' }[], _fields: ExtendedAnalysisFields, previous: StoneAnalysisReport): Promise<StoneAnalysisReport> {
    return { ...previous, summary: `Mock-Antwort für die erweiterte Analyse zu ${previous.identification.name}. Es wurden keine Bilder durch eine KI ausgewertet.`, limitations: [...previous.limitations, 'Mock-Antwort ohne erweiterte KI-Bildauswertung.'] };
  }
}
