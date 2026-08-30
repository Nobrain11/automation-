type Level = "info" | "warn" | "error";

function log(level: Level, message: string, meta?: unknown) {
  const timestamp = new Date().toISOString();

  if (meta !== undefined) {
    console.log(
      `[${timestamp}] [${level}] ${message}`,
      meta
    );
  } else {
    console.log(
      `[${timestamp}] [${level}] ${message}`
    );
  }
}

export const logger = {
  info(message: string, meta?: unknown) {
    log("info", message, meta);
  },

  warn(message: string, meta?: unknown) {
    log("warn", message, meta);
  },

  error(message: string, meta?: unknown) {
    log("error", message, meta);
  }
};
