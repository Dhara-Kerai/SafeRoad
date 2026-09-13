import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { AppError } from './errorHandler';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF protection middleware for cookie-authenticated state-changing requests.
 * Enforces strict Origin / Referer validation against configured CORS origins.
 * Safely exempts safe HTTP methods, server-to-server AI key requests, and Bearer-token requests.
 */
export const csrfProtection = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // 1. Safe HTTP methods (GET, HEAD, OPTIONS) are exempt from CSRF
  if (!MUTATION_METHODS.has(req.method)) {
    return next();
  }

  // 2. Server-to-server internal requests authenticated via X-Internal-Api-Key are exempt
  const internalApiKey = req.headers['x-internal-api-key'];
  if (
    internalApiKey &&
    typeof internalApiKey === 'string' &&
    env.AI_INTERNAL_API_KEY &&
    internalApiKey === env.AI_INTERNAL_API_KEY
  ) {
    return next();
  }

  // 3. Public token lifecycle endpoints (refresh, logout) are exempt from CSRF
  const pathWithoutQuery = (req.originalUrl || req.path).split('?')[0];
  if (
    pathWithoutQuery === '/api/auth/refresh' ||
    pathWithoutQuery.endsWith('/auth/refresh') ||
    pathWithoutQuery === '/api/auth/logout' ||
    pathWithoutQuery.endsWith('/auth/logout')
  ) {
    return next();
  }

  // 4. Check if the request is cookie-authenticated via ambient session token
  const hasAuthCookie = Boolean(req.cookies?.token);
  const hasBearerHeader = Boolean(
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  );

  // If not authenticated via cookies or explicitly using Bearer token auth, exempt
  if (!hasAuthCookie || hasBearerHeader) {
    return next();
  }

  // 4. Strict Origin / Referer validation for cookie-authenticated mutations
  const allowedOrigins = env.CORS_ORIGIN.split(',')
    .map((o) => o.trim().toLowerCase().replace(/\/$/, ''))
    .filter(Boolean);

  let origin = req.headers.origin as string | undefined;

  // Fallback to Referer header if Origin is not explicitly set
  if (!origin && req.headers.referer) {
    try {
      origin = new URL(req.headers.referer).origin;
    } catch {
      origin = undefined;
    }
  }

  if (!origin) {
    return next(
      new AppError(
        'CSRF validation failed: Missing origin or referer header on cookie-authenticated request',
        403
      )
    );
  }

  const normalizedOrigin = origin.toLowerCase().replace(/\/$/, '');

  if (!allowedOrigins.includes(normalizedOrigin)) {
    return next(
      new AppError(
        `CSRF validation failed: Request origin "${origin}" is not authorized`,
        403
      )
    );
  }

  next();
};
