import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AnalysisRepository } from '../../../core/repositories/analysis.repository';
import { StoneAnalysis } from '../../../shared/models/stone-analysis.model';

@Component({ selector: 'app-history-page', imports: [DatePipe, RouterLink], template: `
  <section class="history"><p class="eyebrow">FELDNOTIZEN · ARCHIV</p><div class="heading"><div><h1>Deine Funde</h1><p>Alle Demo-Analysen auf diesem Gerät.</p></div><a routerLink="/">+ Neue Analyse</a></div>
  @if (items().length === 0) { <div class="empty"><span>◇</span><h2>Noch keine Funde dokumentiert</h2><p>Deine Analysen erscheinen hier, sobald du deinen ersten Fund hinzufügst.</p><a routerLink="/">Erste Analyse starten ↗</a></div> }
  @else { <div class="list">@for (item of items(); track item.id) { <article class="entry"><div class="symbol">{{ item.identification.category === 'Mineral' ? '◈' : '▧' }}</div><div class="info"><h2>{{ item.identification.name }}</h2><p>{{ item.identification.category }} · {{ item.createdAt | date:'d. MMM y, HH:mm' }}</p></div><span class="confidence">{{ label(item.identification.confidence) }}</span><a class="open" [routerLink]="['/results', item.id]">Bericht öffnen ↗</a><button type="button" (click)="remove(item.id)" [attr.aria-label]="'Analyse ' + item.identification.name + ' löschen'">×</button></article> }</div> }
  </section>
  `, styles: [`
    :host{display:block}.history{max-width:900px;margin:32px auto 70px}.eyebrow{font-size:16px;letter-spacing:.16em;color:#9b673d;font-weight:700}.heading{display:flex;justify-content:space-between;align-items:flex-end;margin:18px 0 28px}.heading h1{font:50px Georgia,serif;letter-spacing:-.04em;margin:0 0 8px}.heading p{color:#7a786e;margin:0;font-size:16px}.heading>a,.empty>a{background:#283329;color:white;text-decoration:none;padding:12px 16px;border-radius:7px;font-size:16px}.empty{text-align:center;border:1px dashed #d8d1c4;border-radius:14px;padding:70px 20px;background:#fffefa}.empty>span{font-size:38px;color:#b28d5c}.empty h2{font:24px Georgia,serif}.empty p{color:#77746a;margin-bottom:25px}.list{display:flex;flex-direction:column;gap:10px}.entry{display:grid;grid-template-columns:42px 1fr auto auto 34px;gap:14px;align-items:center;background:#fffefa;border:1px solid #e6e1d7;border-radius:10px;padding:15px}.symbol{width:40px;height:40px;border-radius:9px;background:#f3eee3;display:grid;place-items:center;color:#9b673d;font-size:20px}.info h2{font:19px Georgia,serif;margin:0 0 5px}.info p{color:#858176;font-size:16px;margin:0}.confidence{font-size:16px;text-transform:capitalize;color:#666}.open{font-size:16px;color:#80572f;text-decoration:none;white-space:nowrap}.entry button{background:none;border:0;color:#8a887f;font-size:23px;cursor:pointer}@media(max-width:680px){.heading{align-items:flex-start;gap:16px;flex-direction:column}.heading h1{font-size:42px}.entry{grid-template-columns:38px 1fr 30px}.confidence{display:none}.open{grid-column:2;grid-row:2}.entry button{grid-column:3;grid-row:1}}
  `] })
export class HistoryPage implements OnInit {
  private readonly repository = inject(AnalysisRepository); readonly items = signal<StoneAnalysis[]>([]);
  async ngOnInit(): Promise<void> { await this.refresh(); }
  async remove(id: string): Promise<void> { await this.repository.delete(id); await this.refresh(); }
  private async refresh(): Promise<void> { this.items.set(await this.repository.getAll()); }
  label(value: string): string { return ({ low: 'Niedrig', medium: 'Mittel', high: 'Hoch' } as Record<string, string>)[value] ?? value; }
}
