import { Component, inject, signal, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AnalysisRepository } from '../../../core/repositories/analysis.repository';
import { StoneAnalysis } from '../../../shared/models/stone-analysis.model';

@Component({ selector: 'app-result-page', imports: [RouterLink, DatePipe], template: `
  @if (loading()) { <p class="state">Analysebericht wird geladen …</p> }
  @else if (!analysis()) { <section class="state"><h1>Bericht nicht gefunden</h1><p>Dieser Eintrag ist möglicherweise nicht mehr vorhanden.</p><a routerLink="/history">Zur Historie</a></section> }
  @else { <article class="report"><a class="back" routerLink="/history">← Zur Historie</a><div class="report-top"><div class="report-heading"><p class="eyebrow">FELDNOTIZEN · ANALYSEBERICHT</p><h1>{{ analysis()!.identification.name }}</h1><p class="muted">{{ analysis()!.identification.category }} · {{ analysis()!.createdAt | date:'d. MMMM y, HH:mm' }}</p><span class="demo-badge" [class.live-badge]="analysis()!.source === 'ai'">{{ analysis()!.analysisLevel === 'extended' ? 'ERWEITERTE ' : '' }}{{ analysis()!.source === 'ai' ? 'KI-ANALYSE' : 'DEMO · NICHT BILDANALYSIERT' }}</span></div>@if (imageUrls().length) { <div class="result-images">@for(url of imageUrls(); track url) { <img class="result-image" [src]="url" [alt]="'Hochgeladenes Fundstück: ' + analysis()!.identification.name" /> }</div> } @else { <div class="image-placeholder" aria-label="Kein gespeichertes Bild">◈</div> }</div>
    <section class="card lead"><div class="confidence"><span>Confidence</span><strong>{{ confidenceLabel(analysis()!.identification.confidence) }}</strong></div><div><h2>Begründung</h2><p>{{ analysis()!.identification.reasoning }}</p><p>{{ analysis()!.summary }}</p></div></section>
    <div class="grid"><section class="card"><h2>Sichtbare Merkmale</h2><ul>@for(item of analysis()!.visibleFeatures; track item){<li>{{ item }}</li>}</ul></section><section class="card"><h2>Geologischer Kontext</h2><p>{{ analysis()!.geologicalContext }}</p></section><section class="card"><h2>Alternative Identifikationen</h2><ul>@for(item of analysis()!.alternatives; track item){<li>{{ item }}</li>}</ul></section><section class="card"><h2>Empfohlene Untersuchungen</h2><ul>@for(item of analysis()!.recommendedTests; track item){<li>{{ item }}</li>}</ul></section></div>
    <section class="limits"><strong>Grenzen der Analyse</strong><ul>@for(item of analysis()!.limitations; track item){<li>{{ item }}</li>}</ul></section>@if (analysis()!.analysisLevel !== 'extended') { <a class="new" [routerLink]="['/results', analysis()!.id, 'extended']">Erweiterte Analyse starten ↗</a> } <a class="new secondary" routerLink="/">Neue Analyse starten ↗</a></article> }
  `, styles: [`
    :host{display:block}.report{max-width:960px;margin:20px auto 60px}.back{color:#315a3a;text-decoration:none;font-size:16px}.report-top{display:flex;align-items:flex-start;justify-content:space-between;gap:28px;margin:32px 0 24px}.report-heading{flex:1}.eyebrow{font-size:16px;letter-spacing:.12em;color:#4b7054;font-weight:700}.report h1{font:500 clamp(42px,6vw,56px) Georgia,serif;margin:8px 0;letter-spacing:-.04em;color:#293b30}.muted{color:#52645a;font-size:16px;margin:0 0 16px}.demo-badge{display:inline-flex;font-size:16px;letter-spacing:.04em;border:1px solid #bfd0c0;border-radius:999px;padding:9px 14px;color:#385b40;background:#e5eee4}.live-badge{border-color:#afcdb1;color:#315d3a;background:#dcebdd}.result-images{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.result-image,.image-placeholder{width:180px;height:180px;flex:0 0 180px;border-radius:14px;object-fit:cover;background:#e5eee4}.image-placeholder{display:grid;place-items:center;color:#52765a;font-size:48px}.card{background:#fbfcfa;border:1px solid #d9e2d9;border-radius:12px;padding:24px}.lead{display:grid;grid-template-columns:130px 1fr;align-items:center;gap:20px}.confidence{display:flex;flex-direction:column;gap:6px;color:#52645a;font-size:16px}.confidence strong{font:500 20px Georgia,serif;color:#293b30;text-transform:capitalize}.card p,.card li,.limits li{color:#52645a;line-height:1.7;font-size:16px}.card h2{font:500 21px Georgia,serif;margin:0 0 12px;color:#293b30}.card ul,.limits ul{padding-left:19px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:14px 0}.limits{background:#e8efe7;padding:18px;border-radius:9px;font-size:16px;color:#3b5141}.limits ul{margin-bottom:0}.new{display:inline-block;margin:24px 12px 0 0;border-radius:8px;padding:13px 18px;background:#315a3a;color:white;text-decoration:none;font-size:16px}.secondary{background:#68766b}.state{max-width:700px;margin:80px auto;text-align:center}.state a{color:#315a3a}@media(max-width:650px){.report-top{align-items:flex-start;flex-direction:column-reverse}.result-image,.image-placeholder{width:min(100%,240px);height:auto;aspect-ratio:1;flex-basis:auto}.grid{grid-template-columns:1fr}.lead{grid-template-columns:1fr;gap:4px}}
  `, `@media(max-width:650px){.result-images{width:100%;justify-content:center}.image-placeholder{align-self:center}}`] })
export class ResultPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute); private readonly repository = inject(AnalysisRepository);
  readonly analysis = signal<StoneAnalysis | null>(null); readonly imageUrls = signal<string[]>([]); readonly loading = signal(true);
  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const [analysis, images] = await Promise.all([this.repository.getById(id), this.repository.getImages(id)]);
      this.analysis.set(analysis);
      this.imageUrls.set(images.map((image) => URL.createObjectURL(image)));
    }
    this.loading.set(false);
  }
  ngOnDestroy(): void { this.imageUrls().forEach((url) => URL.revokeObjectURL(url)); }
  confidenceLabel(value: string): string { return ({ low: 'Niedrig', medium: 'Mittel', high: 'Hoch' } as Record<string, string>)[value] ?? value; }
}
