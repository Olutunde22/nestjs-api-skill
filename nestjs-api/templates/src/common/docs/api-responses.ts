import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

// LOAD-BEARING: these builders are the only place doc examples learn the envelope. They must
// match ResponseInterceptor and AllExceptionsFilter exactly; change all three together.

const ERROR_NAMES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
};

const DEFAULT_MESSAGES: Record<number, string | string[]> = {
  400: ['name must be shorter than or equal to 120 characters'],
  401: 'Unauthorized',
  403: 'Insufficient permissions',
  404: 'Not found',
  409: 'Conflict',
  422: 'Unprocessable entity',
  429: 'Too many requests',
  500: 'Internal server error',
  502: 'Upstream service failed',
};

const DEFAULT_DESCRIPTIONS: Record<number, string> = {
  400: 'The request failed validation.',
  401: 'No valid session or token.',
  403: 'Signed in, but missing a required permission.',
  404: 'The resource does not exist or is not visible to the caller.',
  409: 'The request conflicts with the current state.',
  422: 'The request is valid but cannot be processed.',
  429: 'Rate limit exceeded.',
  500: 'Unexpected server error.',
  502: 'An upstream service failed.',
};

const EXAMPLE_TIMESTAMP = '2026-01-31T10:00:00.000Z';

export const errorExample = (status: number, message?: string | string[]) => ({
  success: false,
  statusCode: status,
  message: message ?? DEFAULT_MESSAGES[status] ?? 'Error',
  error: ERROR_NAMES[status],
  path: '/api/things',
  timestamp: EXAMPLE_TIMESTAMP,
});

export const ApiOk = (description: string, example: unknown, status = 200) =>
  ApiResponse({ status, description, schema: { example: { success: true, data: example } } });

export const ApiCreated = (description: string, example: unknown) =>
  ApiOk(description, example, 201);

export const ApiPaginatedOk = (
  description: string,
  items: unknown[],
  pagination: { total: number; page: number; pageSize: number } = {
    total: items.length,
    page: 1,
    pageSize: 20,
  },
) =>
  ApiResponse({
    status: 200,
    description,
    schema: { example: { success: true, data: items, pagination } },
  });

export const ApiNoContent = (description: string) => ApiResponse({ status: 204, description });

export const ApiErrorResponse = (
  status: number,
  message?: string | string[],
  description?: string,
) =>
  ApiResponse({
    status,
    description: description ?? DEFAULT_DESCRIPTIONS[status] ?? ERROR_NAMES[status],
    schema: { example: errorExample(status, message) },
  });

export const ApiErrorResponses = (...statuses: number[]) =>
  applyDecorators(...statuses.map((status) => ApiErrorResponse(status)));
