import { Injectable, inject } from '@angular/core';
import { AnalysisRepository } from '../repositories/analysis.repository';
import { AnalysisRequest, StoneAnalysis } from '../../shared/models/stone-analysis.model';

@Injectable({ providedIn: 'root' })
export class StoneAnalysisService {
  private readonly repository = inject(AnalysisRepository);
  private readonly demos: Omit<StoneAnalysis, 'id' | 'createdAt' | 'schemaVersion'>[] = [
    { source: 'demo', identification: { name: 'Amethyst', category: 'Mineral', confidence: 'medium' }, summary: 'Ein violetter Quarz, dessen Farbe typischerweise durch Spuren von Eisen und natürliche Bestrahlung entsteht.', visibleFeatures: ['Violette Farbzonierung', 'Glasglanz', 'Unregelmäßige Bruchflächen'], geologicalContext: 'Amethyst bildet sich häufig in Hohlräumen vulkanischer Gesteine und in hydrothermalen Gängen.', alternatives: ['Fluorit', 'Gefärbtes Glas', 'Lepidolith'], recommendedTests: ['Härteprüfung (Mohs)', 'Beobachtung unter polarisiertem Licht', 'Spezifisches Gewicht bestimmen'], limitations: ['Demo-Ergebnis ohne Bildauswertung. Kein Nachweis oder Gutachten.', 'Farbe allein erlaubt keine sichere Identifikation.'] },
    { source: 'demo', identification: { name: 'Granit', category: 'Gestein', confidence: 'medium' }, summary: 'Ein grobkörniges Tiefengestein, meist aus Quarz, Feldspat und Glimmer zusammengesetzt.', visibleFeatures: ['Körniges Gefüge', 'Helle und dunkle Mineralkörner', 'Keine erkennbare Schichtung'], geologicalContext: 'Granit erstarrt langsam in der Erdkruste und tritt durch Hebung und Erosion zutage.', alternatives: ['Diorit', 'Granitischer Gneis', 'Künstlicher Terrazzo'], recommendedTests: ['Mineralkörner mit Lupe bestimmen', 'Dünnschliff untersuchen'], limitations: ['Demo-Ergebnis ohne Bildauswertung. Kein Nachweis oder Gutachten.', 'Verwitterung kann Farbe und Oberflächenbild verändern.'] },
    { source: 'demo', identification: { name: 'Pyrit', category: 'Mineral', confidence: 'medium' }, summary: 'Eisensulfid mit metallischem Glanz, häufig in würfeligen Kristallen.', visibleFeatures: ['Messinggelber Metallglanz', 'Mögliche würfelige Kristallflächen', 'Dunkle Strichfarbe'], geologicalContext: 'Pyrit entsteht in vielen Umgebungen, etwa in hydrothermalen Gängen und Sedimentgesteinen.', alternatives: ['Chalkopyrit', 'Glimmerndes Hämatit', 'Messing oder andere Legierung'], recommendedTests: ['Strichfarbe auf unglasierter Keramik', 'Kristallform und Härte prüfen'], limitations: ['Demo-Ergebnis ohne Bildauswertung. Kein Nachweis oder Gutachten.', 'Metallischer Glanz und Farbe sind allein nicht eindeutig.'] }
  ];

  async analyzeStone(request: AnalysisRequest): Promise<StoneAnalysis> {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    if (!request.image) throw new Error('Bitte wähle ein Bild aus.');
    const sample = this.demos[Math.floor(Math.random() * this.demos.length)];
    const analysis: StoneAnalysis = { ...sample, id: crypto.randomUUID(), createdAt: new Date().toISOString(), schemaVersion: 1 };
    await this.repository.save(analysis);
    return analysis;
  }
}
