import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/analyzer/analyzer-page/analyzer-page').then((m) => m.AnalyzerPage) },
  { path: 'history', loadComponent: () => import('./features/history/history-page/history-page').then((m) => m.HistoryPage) },
  { path: 'results/:id', loadComponent: () => import('./features/results/result-page/result-page').then((m) => m.ResultPage) },
  { path: 'results/:id/extended', loadComponent: () => import('./features/results/extended-analysis-page/extended-analysis-page').then((m) => m.ExtendedAnalysisPage) },
  { path: '**', redirectTo: '' }
];
