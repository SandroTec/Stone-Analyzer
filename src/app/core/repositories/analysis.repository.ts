import { StoneAnalysis } from '../../shared/models/stone-analysis.model';

export abstract class AnalysisRepository {
  abstract save(analysis: StoneAnalysis): Promise<void>;
  abstract getAll(): Promise<StoneAnalysis[]>;
  abstract getById(id: string): Promise<StoneAnalysis | null>;
  abstract delete(id: string): Promise<void>;
}
