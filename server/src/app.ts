import cors from 'cors';
import express, { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { AppConfig } from './config.js';
import { StoneAnalyzer } from './services/openai.service.js';
import { AnalysisFieldsSchema } from './models/stone-analysis.schema.js';
import { createRateLimiter } from './middleware/rate-limit.js';
import { AppError } from './utils/app-error.js';

const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function createApp(config: AppConfig, analyzer: StoneAnalyzer) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({
    origin(origin, callback) {
      if (!origin || origin === config.FRONTEND_ORIGIN) callback(null, true);
      else callback(new AppError(403, 'Dieser Ursprung ist nicht erlaubt.', 'origin_not_allowed'));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  }));
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Math.floor(config.MAX_IMAGE_SIZE_MB * 1024 * 1024), files: 1, fields: 4, parts: 5 },
    fileFilter(_req, file, callback) {
      if (!MIME_TYPES.has(file.mimetype)) callback(new AppError(415, 'Nur JPEG-, PNG- und WebP-Bilder werden unterstützt.', 'unsupported_image_type'));
      else callback(null, true);
    }
  });

  app.post('/api/analyze', createRateLimiter(config.RATE_LIMIT_WINDOW_MS, config.RATE_LIMIT_MAX_REQUESTS), upload.single('image'), async (req, res) => {
    if (config.ANALYSIS_MODE !== 'live') {
      throw new AppError(503, 'Das Backend ist im Mock-Modus. Aktiviere Live-Modus bewusst in server/.env und im Frontend, um kostenpflichtige Anfragen zu erlauben.', 'live_mode_disabled');
    }
    if (!req.file) throw new AppError(400, 'Ein Bild im Feld "image" ist erforderlich.', 'image_required');
    const detected = await fileTypeFromBuffer(req.file.buffer);
    if (!detected || !MIME_TYPES.has(detected.mime) || detected.mime !== req.file.mimetype) {
      throw new AppError(415, 'Der Dateiinhalt ist kein gültiges JPEG-, PNG- oder WebP-Bild.', 'invalid_image_signature');
    }
    const fields = AnalysisFieldsSchema.safeParse(req.body);
    if (!fields.success) throw new AppError(400, 'Formulardaten ungültig oder zu lang.', 'invalid_fields');
    const report = await analyzer.analyze(req.file.buffer, detected.mime as 'image/jpeg' | 'image/png' | 'image/webp', fields.data);
    res.status(200).json(report);
  });

  const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') { res.status(413).json({ error: { code: 'image_too_large', message: `Das Bild darf höchstens ${config.MAX_IMAGE_SIZE_MB} MB groß sein.` } }); return; }
      res.status(400).json({ error: { code: 'invalid_upload', message: 'Der Upload muss genau ein Bild im Feld "image" enthalten.' } }); return;
    }
    if (error instanceof AppError) { res.status(error.statusCode).json({ error: { code: error.code, message: error.message } }); return; }
    // Avoid logging request bodies, uploaded bytes, user notes, or provider error contents.
    console.error('Unbehandelter Backend-Fehler.');
    res.status(500).json({ error: { code: 'internal_error', message: 'Interner Serverfehler.' } });
  };
  app.use(errors);
  return app;
}
