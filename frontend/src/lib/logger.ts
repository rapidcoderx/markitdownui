/**
 * Lightweight structured logger for the frontend.
 *
 * Log levels: DEBUG < INFO < WARN < ERROR
 *
 * In development (import.meta.env.DEV) the level defaults to DEBUG.
 * In production it defaults to INFO.
 * Override via VITE_LOG_LEVEL env var: VITE_LOG_LEVEL=warn npm run dev
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

function resolveLevel(): LogLevel {
  const env = (import.meta.env.VITE_LOG_LEVEL as string | undefined)?.toLowerCase();
  if (env && env in LEVELS) return env as LogLevel;
  return import.meta.env.DEV ? 'debug' : 'info';
}

const activeLevel = LEVELS[resolveLevel()];

const PREFIX = '[MarkItDown]';

// Colour badges shown in the browser devtools console
const STYLES: Record<string, string> = {
  debug: 'color:#7c8cf8;font-weight:bold',
  info:  'color:#22c55e;font-weight:bold',
  warn:  'color:#f59e0b;font-weight:bold',
  error: 'color:#ef4444;font-weight:bold',
};

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= activeLevel;
}

type ConsoleMethod = 'log' | 'info' | 'warn' | 'error';

function makeLogger(level: LogLevel) {
  return (message: string, ...args: unknown[]) => {
    if (!shouldLog(level)) return;
    const method: ConsoleMethod =
      level === 'debug' || level === 'silent' ? 'log' : level;
    // eslint-disable-next-line no-console
    console[method](
      `%c${PREFIX} [${level.toUpperCase()}]`,
      STYLES[level],
      message,
      ...args,
    );
  };
}

const logger = {
  debug: makeLogger('debug'),
  info:  makeLogger('info'),
  warn:  makeLogger('warn'),
  error: makeLogger('error'),

  /** Create a child logger that prefixes every message with a namespace. */
  child(namespace: string) {
    const ns = `[${namespace}]`;
    return {
      debug: (msg: string, ...a: unknown[]) => logger.debug(`${ns} ${msg}`, ...a),
      info:  (msg: string, ...a: unknown[]) => logger.info(`${ns} ${msg}`, ...a),
      warn:  (msg: string, ...a: unknown[]) => logger.warn(`${ns} ${msg}`, ...a),
      error: (msg: string, ...a: unknown[]) => logger.error(`${ns} ${msg}`, ...a),
    };
  },
};

export default logger;
