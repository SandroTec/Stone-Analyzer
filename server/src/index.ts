import 'dotenv/config';
import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { OpenAIService } from './services/openai.service.js';

try {
  const config = loadConfig();
  const analyzer = config.ANALYSIS_MODE === 'live' ? new OpenAIService(config) : {
    analyze: async () => { throw new Error('Live-Modus ist deaktiviert.'); },
    analyzeExtended: async () => { throw new Error('Live-Modus ist deaktiviert.'); }
  };
  const app = createApp(config, analyzer);
  app.listen(config.PORT, '127.0.0.1', () => {
    console.log(`Stone Analyzer API läuft unter http://127.0.0.1:${config.PORT} (Modus: ${config.ANALYSIS_MODE}).`);
  });
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unbekannter Konfigurationsfehler.';
  console.error(`Backend konnte nicht starten: ${message}`);
  process.exitCode = 1;
}
