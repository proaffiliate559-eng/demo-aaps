export type AiErrorCode =
  | "not_configured"
  | "limit_reached"
  | "rate_limited"
  | "unavailable"
  | "timeout"
  | "network"
  | "invalid_response"
  | "blocked"
  | "bad_request";

const MESSAGES: Record<AiErrorCode, string> = {
  not_configured: "AI styling isn't set up on this server yet. Please try again later.",
  limit_reached: "You've used all your outfit generations for now.",
  rate_limited: "Lots of people are getting styled right now. Please try again in a minute.",
  unavailable: "Our AI stylist is temporarily unavailable. Please try again in a minute.",
  timeout: "The stylist took too long to respond. Please try again.",
  network: "We couldn't reach our AI stylist. Check your connection and try again.",
  invalid_response: "The stylist returned an incomplete answer. Please try again.",
  blocked: "We couldn't style this request. Try a different photo or options.",
  bad_request: "Something about this request wasn't valid. Please review your choices.",
};

/** HTTP status the API route returns for each error. */
export const AI_ERROR_STATUS: Record<AiErrorCode, number> = {
  not_configured: 503,
  limit_reached: 402,
  rate_limited: 429,
  unavailable: 503,
  timeout: 504,
  network: 502,
  invalid_response: 502,
  blocked: 422,
  bad_request: 400,
};

/** Codes where the credit is refunded (anything that isn't the user's success). */
export class AiError extends Error {
  constructor(
    public code: AiErrorCode,
    public detail?: string,
  ) {
    super(MESSAGES[code]);
    this.name = "AiError";
  }
  get userMessage() {
    return MESSAGES[this.code];
  }
  /** Whether trying another model / attempt could help. */
  get retryable() {
    return ["rate_limited", "unavailable", "timeout", "network", "invalid_response"].includes(this.code);
  }
}
