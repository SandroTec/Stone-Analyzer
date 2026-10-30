import { Component, signal, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StoneAnalysisService } from '../../../core/services/stone-analysis.service';
import { validateImage } from '../image-upload/image-validation';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-analyzer-page',
  imports: [ReactiveFormsModule],
  template: `
    <section class="intro"><div><p class="eyebrow">STONE / FIELD · ANALYSATOR</p><h1>Neue Analyse</h1><p class="lede">Lade ein Fundstück hoch und ergänze deine Beobachtungen.</p></div><span class="mode-pill">{{ liveMode ? 'LIVE-MODUS' : 'DEMO-MODUS' }}</span></section>
    <div class="workspace">
      <section class="panel upload-panel" aria-labelledby="upload-title">
        <div class="panel-head"><span class="step">01</span><div><h2 id="upload-title">Dein Fundstück</h2><p>Ein scharfes Foto bei gutem Licht hilft bei der Dokumentation.</p></div></div>
        <div class="dropzone" [class.has-image]="preview()" (dragover)="$event.preventDefault()" (drop)="onDrop($event)">
          @if (preview()) { <img class="preview" [src]="preview()" alt="Vorschau des ausgewählten Fundstücks" /> <button class="remove" type="button" (click)="removeImage()" aria-label="Bild entfernen">×</button> }
          @else { <div class="upload-icon" aria-hidden="true">↥</div><strong>Bild hier ablegen</strong><span>oder vom Gerät auswählen</span><label class="file-button">Bild auswählen<input type="file" accept="image/jpeg,image/png,image/webp" (change)="onFile($event)" /></label><small>JPG, PNG oder WebP · maximal 5 MB</small> }
        </div>
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      </section>
      <form class="panel details-panel" [formGroup]="form" (ngSubmit)="submit()">
        <div class="panel-head"><span class="step">02</span><div><h2>Deine Beobachtungen</h2><p>Alle Angaben sind optional.</p></div></div>
        <label>Fundort<input formControlName="location" placeholder="z. B. Harz, Deutschland" /></label>
        <div class="field-row"><label>Farbe<input formControlName="color" placeholder="z. B. violett, weiß" /></label><label>Ungefähre Größe<input formControlName="approximateSize" placeholder="z. B. 4 cm" /></label></div>
        <label>Weitere Beobachtungen<textarea formControlName="observations" rows="3" placeholder="Glanz, Form, Gewicht oder Fundumstände …"></textarea></label>
        <div class="demo-note"><span>i</span><p>@if (liveMode) { <strong>Live-Modus</strong> · Der Upload wird an dein Backend übermittelt. Es können OpenAI-Kosten entstehen. } @else { <strong>Demo-Modus</strong> · Das Ergebnis wird aus Beispielanalysen gewählt. Es ist keine Bestimmung deines Fotos. }</p></div>
        <button class="analyze" type="submit" [disabled]="!file() || loading()">{{ loading() ? 'Analyse läuft …' : liveMode ? 'KI-Analyse starten' : 'Demo-Analyse starten' }} <span aria-hidden="true">↗</span></button>
      </form>
    </div>
  `,
  styles: [`
    :host{display:block}.intro{max-width:760px;margin:24px auto 44px}.eyebrow,.step{font:700 16px/1.2 Arial,sans-serif;letter-spacing:.17em;color:#9b673d}.intro h1{font:500 clamp(48px,7vw,78px)/.98 Georgia,serif;letter-spacing:-.055em;margin:18px 0}.intro h1 em{color:#9b673d;font-weight:400}.lede{max-width:540px;color:#69685f;line-height:1.7}.workspace{display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:1040px;margin:auto}.panel{background:#fffefa;border:1px solid #e6e1d7;border-radius:16px;padding:28px;box-shadow:0 16px 48px #33250c0a}.panel-head{display:flex;gap:14px;margin-bottom:24px}.step{padding-top:5px}.panel h2{font:500 22px Georgia,serif;margin:0 0 7px}.panel-head p{margin:0;color:#858176;font-size:16px}.dropzone{min-height:340px;border:1px dashed #cfc7b8;border-radius:12px;background:#f8f6f0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;position:relative;color:#5d5d54}.dropzone strong{font:500 18px Georgia,serif}.dropzone span,.dropzone small{font-size:16px;color:#858176}.upload-icon{font-size:32px;color:#9b673d}.file-button{background:#242b25;color:white;padding:11px 20px;border-radius:7px;cursor:pointer;font-size:16px;margin-top:5px}.file-button input{position:absolute;width:1px;height:1px;opacity:0}.preview{width:100%;height:340px;object-fit:contain}.remove{position:absolute;top:10px;right:10px;border:0;border-radius:50%;width:34px;height:34px;background:#fff;color:#333;font-size:23px;cursor:pointer}.details-panel{display:flex;flex-direction:column;gap:17px}label{font-size:16px;font-weight:600;color:#55534c;display:flex;flex-direction:column;gap:7px}input,textarea{border:1px solid #e0dbd0;border-radius:7px;padding:12px;background:#fffefa;font:16px Arial;color:#292d28;outline:none}input:focus,textarea:focus{border-color:#9b673d;box-shadow:0 0 0 3px #9b673d20}textarea{resize:vertical}.field-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.demo-note{background:#f5f1e8;padding:12px;display:flex;gap:10px;border-radius:8px;color:#656257}.demo-note>span{font-weight:bold;color:#9b673d}.demo-note p{font-size:16px;line-height:1.5;margin:0}.analyze{border:0;border-radius:7px;background:#283329;color:#fff;padding:15px;font-size:16px;font-weight:600;cursor:pointer;display:flex;justify-content:space-between}.analyze:disabled{opacity:.45;cursor:not-allowed}.error{color:#a5362b;font-size:16px}.dropzone.has-image{padding:8px}@media(max-width:760px){.workspace{grid-template-columns:1fr}.intro{margin:16px 0 30px}.panel{padding:20px}}
  `]
})
export class AnalyzerPage {
  readonly liveMode = environment.analysisMode === 'live';
  private readonly fb = inject(FormBuilder);
  private readonly analysisService = inject(StoneAnalysisService);
  private readonly router = inject(Router);
  readonly form = this.fb.nonNullable.group({ location: '', color: '', approximateSize: '', observations: '' });
  readonly file = signal<File | null>(null);
  readonly preview = signal<string | null>(null);
  readonly error = signal('');
  readonly loading = signal(false);

  onFile(event: Event): void { const input = event.target as HTMLInputElement; if (input.files?.[0]) this.selectFile(input.files[0]); input.value = ''; }
  onDrop(event: DragEvent): void { event.preventDefault(); const dropped = event.dataTransfer?.files[0]; if (dropped) this.selectFile(dropped); }
  private selectFile(file: File): void {
    this.error.set('');
    const validationError = validateImage(file);
    if (validationError) { this.error.set(validationError); return; }
    this.clearPreview(); this.file.set(file); this.preview.set(URL.createObjectURL(file));
  }
  removeImage(): void { this.clearPreview(); this.error.set(''); }
  private clearPreview(): void { const current = this.preview(); if (current) URL.revokeObjectURL(current); this.preview.set(null); this.file.set(null); }
  async submit(): Promise<void> {
    const image = this.file(); if (!image || this.loading()) return;
    this.loading.set(true); this.error.set('');
    try { const analysis = await this.analysisService.analyzeStone({ image, ...this.form.getRawValue() }); await this.router.navigate(['/results', analysis.id]); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Die Analyse konnte nicht gespeichert werden. Bitte versuche es erneut.'); }
    finally { this.loading.set(false); }
  }
}
