import { FindLocation } from './find-location.model';

export type Confidence = 'low' | 'medium' | 'high';
export type AnalysisCategory = 'Mineral' | 'Gestein' | 'Unbekannt';
export type AnalysisMode = 'mock' | 'live';

export interface AnalysisRequest {
  image: File;
  findLocation?: FindLocation;
  location?: string;
  color?: string;
  approximateSize?: string;
  observations?: string;
}

export interface StoneAnalysis {
  id: string;
  createdAt: string;
  schemaVersion: 1;
  source: 'demo' | 'ai';
  analysisLevel?: 'basic' | 'extended';
  parentAnalysisId?: string;
  extendedAnalysisId?: string;
  observations?: { location: string; color: string; approximateSize: string; observations: string };
  findLocation?: FindLocation;
  identification: { name: string; category: AnalysisCategory; confidence: Confidence; reasoning: string };
  summary: string;
  visibleFeatures: string[];
  geologicalContext: string;
  alternatives: string[];
  recommendedTests: string[];
  limitations: string[];
}

export type AnalysisReport = Omit<StoneAnalysis, 'id' | 'createdAt' | 'schemaVersion' | 'source' | 'analysisLevel' | 'parentAnalysisId' | 'extendedAnalysisId' | 'observations' | 'findLocation'>;
