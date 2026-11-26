import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorEnvelope {
  success: false;
  statusCode: number;
  message: string | string[];
  error?: string;
  errorCode?: string;
  path: string;
  timestamp: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // LOAD-BEARING: anything that is not an HttpException is answered with a generic message.
    // Database errors and provider payloads stay in the log, never in the response.
    let message: string | string[] = 'Internal server error';
    let error: string | undefined;
    let errorCode: string | undefined;

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else {
        const fields = body as { message?: string | string[]; error?: string; errorCode?: string };
        message = fields.message ?? exception.message;
        error = fields.error;
        errorCode = fields.errorCode;
      }
      if (status >= 500) {
        this.logger.error(`${req.method} ${req.url} → ${status}`, exception.stack);
      } else {
        this.logger.warn(`${req.method} ${req.url} → ${status}: ${JSON.stringify(message)}`);
      }
    } else {
      this.logger.error(
        `${req.method} ${req.url} → unhandled`,
        exception instanceof Error ? exception.stack : JSON.stringify(exception),
      );
    }

    const envelope: ErrorEnvelope = {
      success: false,
      statusCode: status,
      message,
      ...(error ? { error } : {}),
      ...(errorCode ? { errorCode } : {}),
      path: req.url,
      timestamp: new Date().toISOString(),
    };
    res.status(status).json(envelope);
  }
}
