import { StoneAnalysis } from '../../shared/models/stone-analysis.model';

export abstract class AnalysisRepository {
  abstract save(analysis: StoneAnalysis, image?: Blob | Blob[]): Promise<void>;
  abstract getAll(): Promise<StoneAnalysis[]>;
  abstract getById(id: string): Promise<StoneAnalysis | null>;
  abstract getImage(id: string): Promise<Blob | null>;
  abstract getImages(id: string): Promise<Blob[]>;
  abstract delete(id: string): Promise<void>;
}
