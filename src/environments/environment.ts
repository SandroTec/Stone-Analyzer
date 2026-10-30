import { AnalysisMode } from '../app/shared/models/stone-analysis.model';

// Live-Modus ist aktiv; API-Schlüssel bleiben ausschließlich in server/.env.
export const environment: { analysisMode: AnalysisMode } = { analysisMode: 'live' };
