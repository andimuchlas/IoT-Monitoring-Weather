import type { Context, MiddlewareHandler } from "hono";
import type { AppBindings } from "../app";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  deviceId?: string;
  userId?: string;
  path?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  [key: string]: any;
}

export class Logger {
  private isProduction: boolean;

  constructor(isProduction = process.env.NODE_ENV === "production") {
    this.isProduction = isProduction;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();

    if (this.isProduction) {
      return JSON.stringify({
        timestamp,
        level: level.toUpperCase(),
        message,
        ...context,
      });
    }

    const colors = {
      debug: "\x1b[34m",
      info: "\x1b[32m",
      warn: "\x1b[33m",
      error: "\x1b[31m",
      reset: "\x1b[0m",
      dim: "\x1b[2m",
    };

    const color = colors[level] || colors.reset;
    const reqInfo = context?.requestId ? ` [req:${context.requestId.slice(0, 8)}]` : "";
    const devInfo = context?.deviceId ? ` [dev:${context.deviceId}]` : "";
    const extra = { ...context };
    delete extra.requestId;
    delete extra.deviceId;

    const extraStr = Object.keys(extra).length > 0 ? ` ${JSON.stringify(extra)}` : "";

    return `${colors.dim}[${timestamp}]${colors.reset} ${color}${level.toUpperCase().padEnd(5)}${colors.reset}${reqInfo}${devInfo} ${message}${extraStr}`;
  }

  public debug(message: string, context?: LogContext): void {
    if (!this.isProduction || process.env.DEBUG === "true") {
      console.debug(this.formatMessage("debug", message, context));
    }
  }

  public info(message: string, context?: LogContext): void {
    console.info(this.formatMessage("info", message, context));
  }

  public warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage("warn", message, context));
  }

  public error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errObj =
      error instanceof Error
        ? {
            errorName: error.name,
            errorMessage: error.message,
            stack: error.stack,
          }
        : error
          ? { rawError: String(error) }
          : {};

    console.error(
      this.formatMessage("error", message, {
        ...context,
        ...errObj,
      })
    );
  }

  public child(boundContext: LogContext) {
    return {
      debug: (msg: string, ctx?: LogContext) => this.debug(msg, { ...boundContext, ...ctx }),
      info: (msg: string, ctx?: LogContext) => this.info(msg, { ...boundContext, ...ctx }),
      warn: (msg: string, ctx?: LogContext) => this.warn(msg, { ...boundContext, ...ctx }),
      error: (msg: string, err?: Error | unknown, ctx?: LogContext) =>
        this.error(msg, err, { ...boundContext, ...ctx }),
    };
  }
}

export const logger = new Logger();

export const httpStructuredLogger = (): MiddlewareHandler<AppBindings> => {
  return async (c: Context<AppBindings>, next) => {
    const start = performance.now();
    const requestId = c.get("requestId") || c.req.header("X-Request-Id") || "unknown";
    const method = c.req.method;
    const path = c.req.path;
    const deviceId = c.req.header("X-Device-Id") || undefined;

    await next();

    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    const status = c.res.status;

    const logCtx: LogContext = {
      requestId,
      method,
      path,
      status,
      durationMs,
      ...(deviceId ? { deviceId } : {}),
    };

    if (status >= 500) {
      logger.error(`HTTP ${method} ${path} responded ${status}`, undefined, logCtx);
    } else if (status >= 400) {
      logger.warn(`HTTP ${method} ${path} responded ${status}`, logCtx);
    } else {
      logger.info(`HTTP ${method} ${path} responded ${status}`, logCtx);
    }
  };
};
