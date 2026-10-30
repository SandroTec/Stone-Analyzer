import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AnalysisRepository } from './core/repositories/analysis.repository';
import { LocalAnalysisRepository } from './core/repositories/local-analysis.repository';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: AnalysisRepository, useExisting: LocalAnalysisRepository }
  ]
};
