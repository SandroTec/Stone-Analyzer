import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max);

export const StoneAnalysisReportSchema = z.object({
  identification: z.object({
    name: text(120),
    category: z.enum(['Mineral', 'Gestein', 'Unbekannt']),
    confidence: z.enum(['low', 'medium', 'high']),
    reasoning: text(1500)
  }).strict(),
  summary: text(1600),
  visibleFeatures: z.array(text(240)).max(12),
  geologicalContext: text(1600),
  alternatives: z.array(text(180)).max(8),
  recommendedTests: z.array(text(300)).max(10),
  limitations: z.array(text(400)).max(10)
}).strict();

export type StoneAnalysisReport = z.infer<typeof StoneAnalysisReportSchema>;

export const StoneAnalysisJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['identification', 'summary', 'visibleFeatures', 'geologicalContext', 'alternatives', 'recommendedTests', 'limitations'],
  properties: {
    identification: {
      type: 'object', additionalProperties: false,
      required: ['name', 'category', 'confidence', 'reasoning'],
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 120 }, category: { type: 'string', enum: ['Mineral', 'Gestein', 'Unbekannt'] },
        confidence: { type: 'string', enum: ['low', 'medium', 'high'] }, reasoning: { type: 'string', minLength: 1, maxLength: 1500 }
      }
    },
    summary: { type: 'string', minLength: 1, maxLength: 1600 }, visibleFeatures: { type: 'array', maxItems: 12, items: { type: 'string', minLength: 1, maxLength: 240 } },
    geologicalContext: { type: 'string', minLength: 1, maxLength: 1600 }, alternatives: { type: 'array', maxItems: 8, items: { type: 'string', minLength: 1, maxLength: 180 } },
    recommendedTests: { type: 'array', maxItems: 10, items: { type: 'string', minLength: 1, maxLength: 300 } }, limitations: { type: 'array', maxItems: 10, items: { type: 'string', minLength: 1, maxLength: 400 } }
  }
} as const;

export const AnalysisFieldsSchema = z.object({
  location: z.string().trim().max(200).optional(),
  color: z.string().trim().max(100).optional(),
  size: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1200).optional()
}).strict();

export type AnalysisFields = z.infer<typeof AnalysisFieldsSchema>;
