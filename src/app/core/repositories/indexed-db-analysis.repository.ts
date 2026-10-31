import { Injectable } from '@angular/core';
import { AnalysisRepository } from './analysis.repository';
import { StoneAnalysis } from '../../shared/models/stone-analysis.model';

interface StoredLegacyAnalyses { schemaVersion: 1; analyses: StoneAnalysis[]; }
interface StoredImage { id: string; analysisId?: string; index?: number; data: ArrayBuffer; mimeType: string; }

function isAnalysis(value: unknown): value is StoneAnalysis {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<StoneAnalysis>;
  return typeof item.id === 'string'
    && typeof item.createdAt === 'string'
    && item.schemaVersion === 1
    && (item.source === 'demo' || item.source === 'ai')
    && typeof item.identification === 'object'
    && item.identification !== null
    && typeof item.identification.name === 'string'
    && typeof item.identification.reasoning === 'string'
    && (item.identification.category === 'Mineral' || item.identification.category === 'Gestein' || item.identification.category === 'Unbekannt')
    && ['low', 'medium', 'high'].includes(item.identification.confidence)
    && typeof item.summary === 'string'
    && Array.isArray(item.visibleFeatures)
    && typeof item.geologicalContext === 'string'
    && Array.isArray(item.alternatives)
    && Array.isArray(item.recommendedTests)
    && Array.isArray(item.limitations);
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB-Anfrage fehlgeschlagen.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB-Transaktion fehlgeschlagen.'));
  });
}

@Injectable({ providedIn: 'root' })
export class IndexedDbAnalysisRepository extends AnalysisRepository {
  private readonly databaseName = 'stone-analyzer';
  private readonly legacyKey = 'stone-analyzer.analyses.v1';
  private databasePromise?: Promise<IDBDatabase>;
  private migrationPromise?: Promise<void>;

  async save(analysis: StoneAnalysis, image?: Blob | Blob[]): Promise<void> {
    await this.ensureLegacyDataMigrated();
    const images = image === undefined ? undefined : (Array.isArray(image) ? image : [image]);
    const imageData = images ? await Promise.all(images.map(async (blob) => ({ blob, data: await blob.arrayBuffer() }))) : undefined;
    const database = await this.openDatabase();
    const transaction = database.transaction(['analyses', 'images'], 'readwrite');
    const completed = transactionDone(transaction);
    transaction.objectStore('analyses').put(analysis);
    if (imageData) {
      const imageStore = transaction.objectStore('images');
      const existingRequest = imageStore.getAll();
      existingRequest.onsuccess = () => {
        (existingRequest.result as StoredImage[]).filter((row) => row.analysisId === analysis.id || row.id === analysis.id).forEach((row) => imageStore.delete(row.id));
        imageData.forEach(({ blob, data }, index) => imageStore.put({ id: `${analysis.id}:${index}`, analysisId: analysis.id, index, data, mimeType: blob.type } satisfies StoredImage));
      };
    }
    await completed;
  }

  async getAll(): Promise<StoneAnalysis[]> {
    await this.ensureLegacyDataMigrated();
    const database = await this.openDatabase();
    const transaction = database.transaction('analyses', 'readonly');
    const completed = transactionDone(transaction);
    const entries = await requestResult(transaction.objectStore('analyses').getAll()) as StoneAnalysis[];
    await completed;
    return entries.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  async getById(id: string): Promise<StoneAnalysis | null> {
    await this.ensureLegacyDataMigrated();
    const database = await this.openDatabase();
    const transaction = database.transaction('analyses', 'readonly');
    const completed = transactionDone(transaction);
    const entry = await requestResult(transaction.objectStore('analyses').get(id)) as StoneAnalysis | undefined;
    await completed;
    return entry ?? null;
  }

  async getImage(id: string): Promise<Blob | null> {
    return (await this.getImages(id))[0] ?? null;
  }

  async getImages(id: string): Promise<Blob[]> {
    await this.ensureLegacyDataMigrated();
    const database = await this.openDatabase();
    const transaction = database.transaction('images', 'readonly');
    const completed = transactionDone(transaction);
    const store = transaction.objectStore('images');
    const rows = await requestResult(store.getAll()) as StoredImage[];
    await completed;
    return rows.filter((image) => image.analysisId === id || image.id === id).sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map((image) => new Blob([image.data], { type: image.mimeType }));
  }

  async delete(id: string): Promise<void> {
    await this.ensureLegacyDataMigrated();
    const database = await this.openDatabase();
    const transaction = database.transaction(['analyses', 'images'], 'readwrite');
    const completed = transactionDone(transaction);
    transaction.objectStore('analyses').delete(id);
    const images = transaction.objectStore('images');
    const rows = await requestResult(images.getAll()) as StoredImage[];
    rows.filter((image) => image.analysisId === id || image.id === id).forEach((image) => images.delete(image.id));
    await completed;
  }

  private openDatabase(): Promise<IDBDatabase> {
    this.databasePromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('analyses')) database.createObjectStore('analyses', { keyPath: 'id' });
        if (!database.objectStoreNames.contains('images')) database.createObjectStore('images', { keyPath: 'id' });
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error ?? new Error('Die lokale Bilddatenbank konnte nicht geöffnet werden.'));
      request.onblocked = () => reject(new Error('Die lokale Bilddatenbank ist durch einen anderen App-Tab blockiert.'));
    }).catch((error: unknown) => {
      this.databasePromise = undefined;
      throw error;
    });
    return this.databasePromise!;
  }

  private async ensureLegacyDataMigrated(): Promise<void> {
    this.migrationPromise ??= this.migrateLegacyData();
    try { await this.migrationPromise; }
    catch (error) { this.migrationPromise = undefined; throw error; }
  }

  private async migrateLegacyData(): Promise<void> {
    const raw = localStorage.getItem(this.legacyKey);
    if (raw) {
      let entries: StoneAnalysis[] | undefined;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null && 'schemaVersion' in parsed && 'analyses' in parsed) {
          const legacy = parsed as StoredLegacyAnalyses;
          if (legacy.schemaVersion === 1 && Array.isArray(legacy.analyses) && legacy.analyses.every(isAnalysis)) entries = legacy.analyses;
        }
      } catch { /* Keep invalid legacy data untouched for recovery. */ }
      if (entries) {
        const database = await this.openDatabase();
        const transaction = database.transaction('analyses', 'readwrite');
        const completed = transactionDone(transaction);
        const store = transaction.objectStore('analyses');
        for (const entry of entries) store.put(entry);
        await completed;
        localStorage.removeItem(this.legacyKey);
      }
    }
    await this.mergeLegacyExtendedEntries();
  }

  private async mergeLegacyExtendedEntries(): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction(['analyses', 'images'], 'readwrite');
    const completed = transactionDone(transaction);
    const analysesStore = transaction.objectStore('analyses');
    const imagesStore = transaction.objectStore('images');
    let analyses: StoneAnalysis[] | undefined;
    let images: StoredImage[] | undefined;
    const mergeWhenReady = () => {
      if (!analyses || !images) return;
      const byId = new Map(analyses.map((entry) => [entry.id, entry]));
      const childrenByParent = new Map<string, StoneAnalysis[]>();
      for (const entry of analyses) {
        if (!entry.parentAnalysisId || !byId.has(entry.parentAnalysisId)) continue;
        const children = childrenByParent.get(entry.parentAnalysisId) ?? [];
        children.push(entry);
        childrenByParent.set(entry.parentAnalysisId, children);
      }
      for (const [parentId, children] of childrenByParent) {
        const parent = byId.get(parentId)!;
        children.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
        const latest = children.at(-1)!;
        const { parentAnalysisId: _parentAnalysisId, extendedAnalysisId: _extendedAnalysisId, ...report } = latest;
        const { extendedAnalysisId: _oldExtendedAnalysisId, ...parentData } = parent;
        analysesStore.put({ ...parentData, ...report, id: parent.id, createdAt: parent.createdAt, schemaVersion: 1, analysisLevel: 'extended', observations: latest.observations ?? parent.observations } satisfies StoneAnalysis);
        const relatedIds = new Set([parentId, ...children.map((child) => child.id)]);
        const relatedImages = images.filter((image) => relatedIds.has(image.analysisId ?? image.id)).sort((a, b) => {
          const aOrder = (a.analysisId ?? a.id) === parentId ? 0 : 1;
          const bOrder = (b.analysisId ?? b.id) === parentId ? 0 : 1;
          return aOrder - bOrder || (a.index ?? 0) - (b.index ?? 0);
        });
        images.filter((image) => relatedIds.has(image.analysisId ?? image.id)).forEach((image) => imagesStore.delete(image.id));
        relatedImages.forEach((image, index) => imagesStore.put({ ...image, id: `${parentId}:${index}`, analysisId: parentId, index } satisfies StoredImage));
        children.forEach((child) => analysesStore.delete(child.id));
      }
    };
    const analysesRequest = analysesStore.getAll();
    const imagesRequest = imagesStore.getAll();
    analysesRequest.onsuccess = () => { analyses = analysesRequest.result as StoneAnalysis[]; mergeWhenReady(); };
    imagesRequest.onsuccess = () => { images = imagesRequest.result as StoredImage[]; mergeWhenReady(); };
    await completed;
  }
}
