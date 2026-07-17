type OperationErrorData = {
  aiCode?: string;
  retryable?: boolean;
  correlationId?: string;
};

export type SafeOperationError = {
  message: string;
  referenceId?: string;
  retryable: boolean;
};

/** Never return a server/provider error message to a customer-facing surface. */
export function formatAiOperationError(error: unknown, fallback: string): SafeOperationError {
  const data = error && typeof error === "object" && "data" in error
    ? (error as { data?: OperationErrorData }).data
    : undefined;
  const messages: Record<string, string> = {
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
  return {
    message: data?.aiCode ? messages[data.aiCode] || fallback : fallback,
    referenceId: data?.correlationId,
    retryable: Boolean(data?.retryable),
  };
}

export function withReference(message: SafeOperationError): string {
  return message.referenceId ? `${message.message} Reference: ${message.referenceId}` : message.message;
}
