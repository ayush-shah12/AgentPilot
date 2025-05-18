import 'dotenv/config';

export const isDev = process.env.APP_ENV === 'development';

/**
 * Solution to only log in development mode
 */
export const debug = {
  /**
   * Log messages only in development mode
   */
  log: (...args: any[]): void => {
    if (isDev) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Log warnings only in development mode
   */
  warn: (...args: any[]): void => {
    if (isDev) {
      console.warn('[DEBUG:WARN]', ...args);
    }
  },

  /**
   * Log errors in both development and production
   */
  error: (...args: any[]): void => {
    if (isDev) {
      console.error('[DEBUG:ERROR]', ...args);
    } else {
      // minimal logging
      console.error(args[0]);
    }
  },
};
