import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AnalysisRepository } from '../../../core/repositories/analysis.repository';
import { StoneAnalysisService } from '../../../core/services/stone-analysis.service';
import { StoneAnalysis } from '../../../shared/models/stone-analysis.model';
import { validateImage } from '../../analyzer/image-upload/image-validation';

@Component({ selector: 'app-extended-analysis-page', imports: [ReactiveFormsModule, RouterLink], template: `
  @if (loadingBase()) { <p class="state">Ausgangsanalyse wird geladen …</p> }
  @else if (!base()) { <section class="state"><h1>Analyse nicht gefunden</h1><p>Der Ausgangsbericht ist nicht mehr verfügbar.</p></section> }
  @else { <main class="extended"><a class="back" [routerLink]="['/results', base()!.id]">← Zurück zum Bericht</a><p class="eyebrow">FELDNOTIZEN · VERTIEFUNG</p><h1>Erweiterte Analyse</h1><p class="lede">Ergänze deine Beobachtungen. Die Angaben sind erforderlich; bis zu vier zusätzliche Fotos sind optional.</p>
    <section class="panel"><h2>Beobachtungen</h2><p class="sub">Vorhandene Angaben sind vorausgefüllt. Bitte prüfe sie und ergänze fehlende Informationen.</p><form [formGroup]="form" (ngSubmit)="submit()">
      <label>Fundort *<input required formControlName="location" placeholder="z. B. Harz, Deutschland" /></label>
      <div class="row"><label>Farbe *<input required formControlName="color" placeholder="z. B. violett, weiß" /></label><label>Ungefähre Größe *<input required formControlName="approximateSize" placeholder="z. B. 4 cm" /></label></div>
      <label>Weitere Beobachtungen *<textarea required rows="4" formControlName="observations" placeholder="Glanz, Form, Gewicht oder Fundumstände …"></textarea></label>
      <h2 class="photo-title">Zusätzliche Fotos <span>(optional, maximal 4)</span></h2><p class="sub">Das erste Foto bleibt im ursprünglichen Bericht. Wähle hier zusätzliche Ansichten, zum Beispiel Detail- und Rückseiten.</p>
      <label class="file-picker">Bilder auswählen<input type="file" accept="image/jpeg,image/png,image/webp" multiple (change)="onFiles($event)" /></label>
      @if (selected().length) { <div class="previews">@for (item of selected(); track item.url) { <figure><img [src]="item.url" [alt]="item.file.name"/><figcaption>{{ item.file.name }}</figcaption><button type="button" (click)="removeFile(item.url)" [attr.aria-label]="item.file.name + ' entfernen'">Entfernen</button></figure> }</div> }
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      <aside class="cost-note"><strong>Mehr Aufwand und mögliche Kosten</strong><p>Die erweiterte Analyse dauert meist länger und kann durch zusätzliche KI-Verarbeitung höhere Kosten verursachen. Im Demo-Modus wird keine KI-Anfrage gesendet.</p></aside>
      <button class="submit" type="submit" [disabled]="form.invalid || submitting()">{{ submitting() ? 'Erweiterte Analyse läuft …' : 'Erweiterte Analyse starten ↗' }}</button>
    </form></section>
  </main> }
  `, styles: [`
    :host{display:block}.extended{max-width:760px;margin:28px auto 70px}.back{color:#315a3a;text-decoration:none;font-size:16px}.eyebrow{margin:30px 0 8px;color:#9b673d;font-size:16px;font-weight:700;letter-spacing:.15em}.extended h1{font:500 clamp(42px,6vw,58px) Georgia,serif;letter-spacing:-.04em;margin:0 0 12px;color:#293b30}.lede{font-size:18px;color:#52645a;line-height:1.6;margin:0 0 24px}.panel{padding:28px;background:#fffefa;border:1px solid #e6e1d7;border-radius:14px;box-shadow:0 16px 48px #33250c0a}.panel h2{font:500 24px Georgia,serif;color:#293b30;margin:0 0 8px}.sub{font-size:16px;color:#69685f;line-height:1.55;margin:0 0 20px}form{display:flex;flex-direction:column;gap:17px}label{display:flex;flex-direction:column;gap:7px;font-size:16px;font-weight:600;color:#55534c}.row{display:grid;grid-template-columns:1fr 1fr;gap:14px}input:not([type=file]),textarea{width:100%;box-sizing:border-box;border:1px solid #e0dbd0;border-radius:7px;padding:12px;background:#fffefa;font:16px Arial;color:#292d28}input:focus,textarea:focus{outline:2px solid #9b673d55;border-color:#9b673d}textarea{resize:vertical}.photo-title{margin:8px 0 -10px!important}.photo-title span{font:16px Arial;color:#68766b}.file-picker{display:inline-flex;align-self:flex-start;position:relative;background:#283329;color:white;padding:12px 18px;border-radius:7px;cursor:pointer}.file-picker input{position:absolute;width:1px;height:1px;opacity:0}.previews{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.previews figure{position:relative;margin:0;border:1px solid #dedbd2;border-radius:8px;padding:8px;min-width:0}.previews img{width:100%;height:100px;object-fit:cover;border-radius:5px}.previews figcaption{font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:5px 0}.previews button{border:0;background:transparent;color:#8f342c;text-decoration:underline;cursor:pointer;font-size:16px;padding:3px 0}.cost-note{background:#f5f1e8;border-radius:8px;padding:14px 16px;color:#514b3f}.cost-note strong,.cost-note p{font-size:16px}.cost-note p{line-height:1.5;margin:5px 0 0}.submit{border:0;border-radius:7px;background:#283329;color:white;padding:15px;font-size:17px;font-weight:600;cursor:pointer}.submit:disabled{opacity:.5;cursor:not-allowed}.error{font-size:16px;color:#a5362b}.state{max-width:700px;margin:80px auto;text-align:center;font-size:18px}@media(max-width:650px){.panel{padding:20px}.row{grid-template-columns:1fr}.previews{grid-template-columns:repeat(2,1fr)}}
  `] })
export class ExtendedAnalysisPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly repository = inject(AnalysisRepository);
  private readonly service = inject(StoneAnalysisService);
  private readonly fb = inject(FormBuilder);
  readonly form = this.fb.nonNullable.group({ location: ['', Validators.required], color: ['', Validators.required], approximateSize: ['', Validators.required], observations: ['', Validators.required] });
  readonly base = signal<StoneAnalysis | null>(null);
  readonly loadingBase = signal(true);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly selected = signal<{file: File; url: string}[]>([]);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    const base = id ? await this.repository.getById(id) : null;
    this.base.set(base);
    if (base?.observations) this.form.patchValue(base.observations);
    this.loadingBase.set(false);
  }
  ngOnDestroy(): void { this.selected().forEach(({url}) => URL.revokeObjectURL(url)); }
  onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.error.set('');
    if (this.selected().length + files.length > 4) { this.error.set('Du kannst höchstens vier zusätzliche Bilder auswählen.'); return; }
    for (const file of files) {
      const issue = validateImage(file);
      if (issue) { this.error.set(issue); return; }
    }
    this.selected.update((current) => [...current, ...files.map((file) => ({file, url: URL.createObjectURL(file)}))]);
  }
  removeFile(url: string): void { URL.revokeObjectURL(url); this.selected.update((items) => items.filter((item) => item.url !== url)); }
  async submit(): Promise<void> {
    const base = this.base();
    if (!base || this.form.invalid || this.submitting()) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true); this.error.set('');
    try {
      const result = await this.service.analyzeExtended(base, this.form.getRawValue(), this.selected().map(({file}) => file));
      await this.router.navigate(['/results', result.id]);
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Die erweiterte Analyse konnte nicht abgeschlossen werden.'); }
    finally { this.submitting.set(false); }
  }
}
