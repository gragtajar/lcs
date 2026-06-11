// Named logger (addendum T1). Forwards warn/error to Sentry in production.
//
// Browser-safe: Sentry forwarding only runs in the browser in production, so
// importing this from build-time code is harmless (it just logs to console).

import type { SeverityLevel } from '@sentry/core';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogContext = Record<string, unknown>;

const LEVEL_PRIORITY: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const SENTRY_SEVERITY: Record<LogLevel, SeverityLevel> = {
  debug: 'debug',
  info: 'info',
  warn: 'warning', // Sentry spells it 'warning', not 'warn'
  error: 'error',
};

const MIN_LEVEL: LogLevel = import.meta.env.PROD ? 'info' : 'debug';
const SENTRY_MIN_LEVEL: LogLevel = 'warn';

export interface Logger {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, context?: LogContext) => void;
}

function inBrowser(): boolean {
  return typeof window !== 'undefined';
}

async function forwardToSentry(
  level: LogLevel,
  message: string,
  payload: LogContext,
): Promise<void> {
  // Only forward from the browser in production builds; dynamic import keeps the
  // Sentry SDK out of any server/build bundle that imports this logger.
  if (!inBrowser() || !import.meta.env.PROD) return;
  try {
    const sentry = await import('@sentry/browser');
    if (level === 'error') {
      sentry.captureException(new Error(message), { extra: payload });
    } else {
      sentry.captureMessage(message, { level: SENTRY_SEVERITY[level], extra: payload });
    }
  } catch {
    // Sentry not available (e.g. not initialised) — never let logging throw.
  }
}

/**
 * Create a named logger scoped to a module or island.
 *
 * @param name - Dotted name, e.g. `'island.search-overlay'`, `'lib.taxonomy'`.
 */
export function createLogger(name: string): Logger {
  function emit(level: LogLevel, message: string, context?: LogContext): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[MIN_LEVEL]) return;
    const payload: LogContext = { logger: name, ...(context ?? {}) };
    const method = level === 'debug' ? 'log' : level;
    // eslint-disable-next-line no-console -- the logger is the only allowed console caller
    console[method](`[${name}] ${message}`, payload);
    if (LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[SENTRY_MIN_LEVEL]) {
      void forwardToSentry(level, `[${name}] ${message}`, payload);
    }
  }

  return {
    debug: (m, c) => emit('debug', m, c),
    info: (m, c) => emit('info', m, c),
    warn: (m, c) => emit('warn', m, c),
    error: (m, c) => emit('error', m, c),
  };
}
