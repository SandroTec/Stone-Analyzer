import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AnalysisRepository } from './core/repositories/analysis.repository';
import { LocalAnalysisRepository } from './core/repositories/local-analysis.repository';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    { provide: AnalysisRepository, useExisting: LocalAnalysisRepository }
  ]
};
