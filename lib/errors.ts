// Database functions raise business errors with SQLSTATE P0001, a friendly
// message and a machine code in HINT (see private.fail). This turns any
// Supabase/PostgREST error into something safe to show the user.
export interface AppError {
  code: string;
  message: string;
  status: number;
}

interface PgLikeError {
  code?: string;
  message?: string;
  hint?: string | null;
  details?: string | null;
}

const STATUS: Record<string, number> = {
  forbidden: 403,
  not_signed_in: 401,
  not_registered: 404,
  customer_not_found: 404,
  business_not_found: 404,
  not_found: 404,
  duplicate_bill: 409,
  possible_duplicate: 409,
  slug_taken: 409,
  phone_linked: 409,
};

export function toAppError(err: unknown): AppError {
  const e = (err ?? {}) as PgLikeError;
  if (e.code === 'P0001' && e.hint) {
    return { code: e.hint, message: e.message || 'Something went wrong', status: STATUS[e.hint] ?? 400 };
  }
  if (e.code === '42501') return { code: 'forbidden', message: 'You do not have permission for this', status: 403 };
  if (e.code === '23505') return { code: 'conflict', message: 'This already exists', status: 409 };
  return { code: 'server_error', message: 'Something went wrong. Please try again.', status: 500 };
}
