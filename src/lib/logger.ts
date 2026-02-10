type LogMeta = Record<string, unknown>;

const formatMeta = (meta?: LogMeta) => (meta && Object.keys(meta).length > 0 ? meta : undefined);

export const logger = {
  info(message: string, meta?: LogMeta) {
    console.info(`[INFO] ${message}`, formatMeta(meta));
  },
  warn(message: string, meta?: LogMeta) {
    console.warn(`[WARN] ${message}`, formatMeta(meta));
  },
  error(message: string, meta?: LogMeta) {
    console.error(`[ERROR] ${message}`, formatMeta(meta));
  },
  debug(message: string, meta?: LogMeta) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, formatMeta(meta));
    }
  },
};
