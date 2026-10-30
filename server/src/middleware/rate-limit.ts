import { RequestHandler } from 'express';

export function createRateLimiter(windowMs: number, maxRequests: number): RequestHandler {
  const requests = new Map<string, { count: number; resetAt: number }>();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of requests) if (value.resetAt <= now) requests.delete(key);
    const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const current = requests.get(key);
    if (current && current.resetAt > now && current.count >= maxRequests) {
      res.status(429).json({ error: { code: 'rate_limit_exceeded', message: 'Zu viele Anfragen. Bitte warte kurz und versuche es erneut.' } });
      return;
    }
    if (!current || current.resetAt <= now) requests.set(key, { count: 1, resetAt: now + windowMs });
    else current.count++;
    next();
  };
}
