import { nanoid } from "nanoid";
import { logger } from "./logger";
import { captureException } from "./sentry";

export const AI_OPERATION_CODES = [
  "MEDIA_INVALID",
  "MEDIA_UNSUPPORTED",
  "MEDIA_TOO_LARGE",
  "MEDIA_UNAVAILABLE",
  "PROVIDER_REJECTED_INPUT",
  "PROVIDER_RATE_LIMITED",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_UNAUTHORIZED",
  "PROVIDER_TIMEOUT",
  "PROVIDER_INVALID_RESPONSE",
  "CONTENT_BLOCKED",
] as const;

export type AiOperationCode = typeof AI_OPERATION_CODES[number];

const USER_MESSAGES: Record<AiOperationCode, string> = {
  MEDIA_INVALID: "This file is damaged or is not a valid media file. Please choose another file.",
  MEDIA_UNSUPPORTED: "This file type is not supported. Please choose a supported image, PDF, audio, or video file.",
  MEDIA_TOO_LARGE: "This file is too large. Please upload a file smaller than 50 MB.",
  MEDIA_UNAVAILABLE: "We could not retrieve this file. Please upload it again.",
  PROVIDER_REJECTED_INPUT: "The AI service could not process this file. Please try another file or format.",
  PROVIDER_RATE_LIMITED: "The AI service is busy. Please try again in a moment.",
  PROVIDER_UNAVAILABLE: "The AI service is temporarily unavailable. Please try again shortly.",
  PROVIDER_UNAUTHORIZED: "The AI service is not available right now. Please contact support if this continues.",
  PROVIDER_TIMEOUT: "The AI service is still processing this file. Please try again.",
  PROVIDER_INVALID_RESPONSE: "The AI service returned an unusable result. Please try again.",
  CONTENT_BLOCKED: "The AI service could not process this content. Please review the file and try another one.",
};

export class AiOperationError extends Error {
  readonly correlationId: string;

  constructor(
    readonly code: AiOperationCode,
    readonly options: {
      operation: string;
      retryable?: boolean;
      cause?: unknown;
      providerStatus?: number;
      correlationId?: string;
    },
  ) {
    super(USER_MESSAGES[code]);
    this.name = "AiOperationError";
    this.correlationId = options.correlationId ?? nanoid(12);
  }

  get retryable(): boolean {
    return this.options.retryable ?? false;
  }

  get operation(): string {
    return this.options.operation;
  }

  report(metadata: Record<string, unknown> = {}): this {
    const context = {
      source: "ai-operation",
      operation: this.operation,
      aiCode: this.code,
      retryable: this.retryable,
      providerStatus: this.options.providerStatus,
      correlationId: this.correlationId,
      ...metadata,
    };
    logger.error("AI operation failed", context);
    captureException(this.options.cause ?? this, context);
    return this;
  }
}

export function getAiOperationError(error: unknown): AiOperationError | undefined {
  if (error instanceof AiOperationError) return error;
  if (error && typeof error === "object" && "cause" in error) {
    return getAiOperationError((error as { cause?: unknown }).cause);
  }
  return undefined;
}

export function toAiOperationError(
  error: unknown,
  operation: string,
): AiOperationError {
  const existing = getAiOperationError(error);
  if (existing) return existing;

  if (error instanceof DOMException && error.name === "TimeoutError") {
    return new AiOperationError("PROVIDER_TIMEOUT", { operation, retryable: true, cause: error });
  }

  return new AiOperationError("PROVIDER_UNAVAILABLE", { operation, retryable: true, cause: error });
}

export type AiOperationFailure = {
  code: AiOperationCode;
  message: string;
  retryable: boolean;
  referenceId: string;
};

export function toAiOperationFailure(error: unknown, operation: string): AiOperationFailure {
  const normalized = toAiOperationError(error, operation).report();
  return {
    code: normalized.code,
    message: normalized.message,
    retryable: normalized.retryable,
    referenceId: normalized.correlationId,
  };
}
