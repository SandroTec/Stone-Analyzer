import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AnalysisRepository } from '../repositories/analysis.repository';
import { AnalysisReport, AnalysisRequest, StoneAnalysis } from '../../shared/models/stone-analysis.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class StoneAnalysisService {
  private readonly repository = inject(AnalysisRepository);
  private readonly http = inject(HttpClient);
  private readonly demos: AnalysisReport[] = [
    { identification: { name: 'Amethyst', category: 'Mineral', confidence: 'medium', reasoning: 'Das violette Erscheinungsbild passt zu Quarz, ist ohne echte Bildauswertung aber nicht überprüft.' }, summary: 'Ein violetter Quarz, dessen Farbe typischerweise durch Spuren von Eisen und natürliche Bestrahlung entsteht.', visibleFeatures: ['Violette Farbzonierung', 'Glasglanz', 'Unregelmäßige Bruchflächen'], geologicalContext: 'Amethyst bildet sich häufig in Hohlräumen vulkanischer Gesteine und in hydrothermalen Gängen.', alternatives: ['Fluorit', 'Gefärbtes Glas', 'Lepidolith'], recommendedTests: ['Härteprüfung (Mohs)', 'Beobachtung unter polarisiertem Licht', 'Spezifisches Gewicht bestimmen'], limitations: ['Demo-Ergebnis ohne Bildauswertung. Kein Nachweis oder Gutachten.', 'Farbe allein erlaubt keine sichere Identifikation.'] },
    { identification: { name: 'Granit', category: 'Gestein', confidence: 'medium', reasoning: 'Das Beispiel zeigt ein typisches grobkörniges Gefüge; es wurde nicht mit dem ausgewählten Bild verglichen.' }, summary: 'Ein grobkörniges Tiefengestein, meist aus Quarz, Feldspat und Glimmer zusammengesetzt.', visibleFeatures: ['Körniges Gefüge', 'Helle und dunkle Mineralkörner', 'Keine erkennbare Schichtung'], geologicalContext: 'Granit erstarrt langsam in der Erdkruste und tritt durch Hebung und Erosion zutage.', alternatives: ['Diorit', 'Granitischer Gneis', 'Künstlicher Terrazzo'], recommendedTests: ['Mineralkörner mit Lupe bestimmen', 'Dünnschliff untersuchen'], limitations: ['Demo-Ergebnis ohne Bildauswertung. Kein Nachweis oder Gutachten.', 'Verwitterung kann Farbe und Oberflächenbild verändern.'] },
    { identification: { name: 'Pyrit', category: 'Mineral', confidence: 'medium', reasoning: 'Das Beispiel beschreibt einen typischen metallischen Glanz, der für das ausgewählte Foto nicht geprüft wurde.' }, summary: 'Eisensulfid mit metallischem Glanz, häufig in würfeligen Kristallen.', visibleFeatures: ['Messinggelber Metallglanz', 'Mögliche würfelige Kristallflächen', 'Dunkle Strichfarbe'], geologicalContext: 'Pyrit entsteht in vielen Umgebungen, etwa in hydrothermalen Gängen und Sedimentgesteinen.', alternatives: ['Chalkopyrit', 'Glimmerndes Hämatit', 'Messing oder andere Legierung'], recommendedTests: ['Strichfarbe auf unglasierter Keramik', 'Kristallform und Härte prüfen'], limitations: ['Demo-Ergebnis ohne Bildauswertung. Kein Nachweis oder Gutachten.', 'Metallischer Glanz und Farbe sind allein nicht eindeutig.'] }
  ];

  async analyzeStone(request: AnalysisRequest): Promise<StoneAnalysis> {
    if (!request.image) throw new Error('Bitte wähle ein Bild aus.');
    let report: AnalysisReport;
    if (environment.analysisMode === 'live') {
      const form = new FormData();
      form.append('image', request.image, request.image.name);
      if (request.location) form.append('location', request.location);
      if (request.color) form.append('color', request.color);
      if (request.approximateSize) form.append('size', request.approximateSize);
      if (request.observations) form.append('notes', request.observations);
      try { report = await firstValueFrom(this.http.post<AnalysisReport>('/api/analyze', form)); }
      catch (error) {
        if (error instanceof HttpErrorResponse) {
          const message = error.error?.error?.message;
          throw new Error(typeof message === 'string' ? message : 'Backend nicht erreichbar. Prüfe, ob der Server läuft.');
        }
        throw error;
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, 650));
      report = this.demos[Math.floor(Math.random() * this.demos.length)];
    }
    const analysis: StoneAnalysis = { ...report, source: environment.analysisMode === 'live' ? 'ai' : 'demo', analysisLevel: 'basic', observations: { location: request.location ?? '', color: request.color ?? '', approximateSize: request.approximateSize ?? '', observations: request.observations ?? '' }, id: crypto.randomUUID(), createdAt: new Date().toISOString(), schemaVersion: 1 };
    await this.repository.save(analysis, request.image);
    return analysis;
  }

  async analyzeExtended(base: StoneAnalysis, fields: NonNullable<StoneAnalysis['observations']>, images: File[]): Promise<StoneAnalysis> {
    if (images.length > 4) throw new Error('Es sind höchstens vier zusätzliche Bilder erlaubt.');
    const originalImage = await this.repository.getImage(base.id);
    if (!originalImage) throw new Error('Das Originalbild dieser Analyse ist nicht mehr verfügbar. Ohne dieses Bild kann die erweiterte Analyse nicht gestartet werden.');
    let report: AnalysisReport;
    if (environment.analysisMode === 'live') {
      const form = new FormData();
      const originalExtension = originalImage.type === 'image/png' ? 'png' : originalImage.type === 'image/webp' ? 'webp' : 'jpg';
      form.append('image', originalImage, `original.${originalExtension}`);
      form.append('location', fields.location);
      form.append('color', fields.color);
      form.append('size', fields.approximateSize);
      form.append('notes', fields.observations);
      form.append('previousReport', JSON.stringify(this.reportOnly(base)));
      images.forEach((image) => form.append('images', image, image.name));
      try { report = await firstValueFrom(this.http.post<AnalysisReport>('/api/analyze/extended', form)); }
      catch (error) {
        if (error instanceof HttpErrorResponse) {
          const message = error.error?.error?.message;
          throw new Error(typeof message === 'string' ? message : 'Backend nicht erreichbar. Prüfe, ob der Server läuft.');
        }
        throw error;
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, 900));
      report = { ...this.demos[0], summary: `Demo-Ergebnis einer erweiterten Analyse zu ${base.identification.name}. Es wurden keine Bilder durch eine KI ausgewertet.` };
    }
    const { parentAnalysisId: _parentAnalysisId, extendedAnalysisId: _extendedAnalysisId, ...baseFields } = base;
    const updated: StoneAnalysis = { ...baseFields, ...report, source: environment.analysisMode === 'live' ? 'ai' : 'demo', analysisLevel: 'extended', observations: fields, id: base.id, createdAt: base.createdAt, schemaVersion: 1 };
    await this.repository.save(updated, [originalImage, ...images]);
    return updated;
  }

  private reportOnly(analysis: StoneAnalysis): AnalysisReport {
    const { identification, summary, visibleFeatures, geologicalContext, alternatives, recommendedTests, limitations } = analysis;
    return { identification, summary, visibleFeatures, geologicalContext, alternatives, recommendedTests, limitations };
  }
}
