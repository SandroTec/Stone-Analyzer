import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AnalysisRepository } from '../../../core/repositories/analysis.repository';
import { StoneAnalysis } from '../../../shared/models/stone-analysis.model';

@Component({ selector: 'app-history-page', imports: [DatePipe, RouterLink], template: `
  <section class="history"><p class="eyebrow">FELDNOTIZEN · ARCHIV</p><div class="heading"><div><h1>Deine Funde</h1><p>Alle Demo-Analysen auf diesem Gerät.</p></div><a routerLink="/">+ Neue Analyse</a></div>
  @if (items().length === 0) { <div class="empty"><span>◇</span><h2>Noch keine Funde dokumentiert</h2><p>Deine Analysen erscheinen hier, sobald du deinen ersten Fund hinzufügst.</p><a routerLink="/">Erste Analyse starten ↗</a></div> }
  @else { <div class="list">@for (item of items(); track item.id) { <article class="entry" role="link" tabindex="0" (click)="open(item.id)" (keydown.enter)="open(item.id)" (keydown.space)="$event.preventDefault(); open(item.id)" [attr.aria-label]="'Analyse öffnen: ' + item.identification.name"><div class="thumb">@if (imageUrls()[item.id]) { <img [src]="imageUrls()[item.id]" [alt]="'Hochgeladenes Bild: ' + item.identification.name" /> } @else { <span aria-hidden="true">{{ item.identification.category === 'Mineral' ? '◈' : '▧' }}</span> }</div><div class="info"><h2>{{ item.identification.name }}</h2><p>{{ item.analysisLevel === 'extended' ? 'Erweiterte Analyse · ' : '' }}{{ item.identification.category }} · {{ item.createdAt | date:'d. MMM y, HH:mm' }}</p></div><span class="confidence">{{ label(item.identification.confidence) }}</span><button class="delete" type="button" (click)="$event.stopPropagation(); remove(item.id)" [attr.aria-label]="'Analyse ' + item.identification.name + ' löschen'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg></button></article> }</div> }
  </section>
  `, styles: [`
    :host{display:block}.history{max-width:960px;margin:32px auto 70px}.eyebrow{font-size:16px;letter-spacing:.16em;color:#4b7054;font-weight:700}.heading{display:flex;justify-content:space-between;align-items:flex-end;margin:18px 0 28px}.heading h1{font:500 48px Georgia,serif;letter-spacing:-.04em;margin:0 0 8px}.heading p{color:#52645a;margin:0;font-size:16px}.heading>a,.empty>a{background:#315a3a;color:white;text-decoration:none;padding:12px 16px;border-radius:8px;font-size:16px}.empty{text-align:center;border:1px dashed #b9cbbb;border-radius:14px;padding:70px 20px;background:#fbfcfa}.empty>span{font-size:38px;color:#51735b}.empty h2{font:500 24px Georgia,serif}.empty p{color:#52645a;margin-bottom:25px}.list{display:flex;flex-direction:column;gap:12px}.entry{display:grid;grid-template-columns:72px 1fr auto 44px;gap:18px;align-items:center;background:#fbfcfa;border:1px solid #d9e2d9;border-radius:12px;padding:14px;cursor:pointer;transition:border-color .15s,box-shadow .15s}.entry:hover{border-color:#91ad94;box-shadow:0 3px 12px #27432d12}.entry:focus-visible{outline:3px solid #719276;outline-offset:3px}.thumb{width:72px;height:72px;overflow:hidden;border-radius:9px;background:#e5eee4;display:grid;place-items:center;color:#426349;font-size:24px}.thumb img{width:100%;height:100%;object-fit:cover}.info h2{font:500 21px Georgia,serif;margin:0 0 6px;color:#293b30}.info p{color:#52645a;font-size:16px;margin:0}.confidence{font-size:16px;text-transform:capitalize;color:#405746}.delete{display:grid;place-items:center;background:transparent;border:0;border-radius:8px;color:#52645a;cursor:pointer;width:44px;height:44px}.delete:hover{color:#a1342b;background:#f8e9e6}.delete:focus-visible{outline:3px solid #719276;outline-offset:2px}.delete svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}@media(max-width:720px){.heading{align-items:flex-start;gap:16px;flex-direction:column}.heading h1{font-size:42px}.entry{grid-template-columns:60px 1fr 40px;gap:12px}.thumb{width:60px;height:60px}.confidence{display:none}.delete{grid-column:3;grid-row:1}}
  `] })
export class HistoryPage implements OnInit, OnDestroy {
  private readonly repository = inject(AnalysisRepository); private readonly router = inject(Router); readonly items = signal<StoneAnalysis[]>([]); readonly imageUrls = signal<Record<string, string>>({});
  async ngOnInit(): Promise<void> { await this.refresh(); }
  ngOnDestroy(): void { this.revokeImageUrls(); }
  open(id: string): void { void this.router.navigate(['/results', id]); }
  async remove(id: string): Promise<void> {
    const item = this.items().find((entry) => entry.id === id);
    if (!item || !window.confirm(`Möchtest du die Analyse „${item.identification.name}“ wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return;
    await this.repository.delete(id);
    await this.refresh();
  }
  private async refresh(): Promise<void> {
    this.revokeImageUrls();
    const entries = await this.repository.getAll();
    const urls: Record<string, string> = {};
    await Promise.all(entries.map(async (entry) => {
      const image = await this.repository.getImage(entry.id);
      if (image) urls[entry.id] = URL.createObjectURL(image);
    }));
    this.imageUrls.set(urls);
    this.items.set(entries);
  }
  private revokeImageUrls(): void { for (const url of Object.values(this.imageUrls())) URL.revokeObjectURL(url); this.imageUrls.set({}); }
  label(value: string): string { return ({ low: 'Niedrig', medium: 'Mittel', high: 'Hoch' } as Record<string, string>)[value] ?? value; }
}
