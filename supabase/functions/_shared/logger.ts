export interface LoggerContext {
  function: string;
  requestId?: string | null;
}

function format(context: LoggerContext, args: unknown[]) {
  const ts = new Date().toISOString();
  const parts = [`[${ts}]`, `[${context.function}]`];
  if (context.requestId) parts.push(`[req:${context.requestId}]`);
  return [...parts, ...args];
}

export function createLogger(context: LoggerContext) {
  return {
    info: (...args: unknown[]) => console.info(...format(context, args)),
    warn: (...args: unknown[]) => console.warn(...format(context, args)),
    error: (...args: unknown[]) => console.error(...format(context, args)),
  };
}
