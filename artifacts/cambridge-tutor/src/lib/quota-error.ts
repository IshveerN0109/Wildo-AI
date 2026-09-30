// Duck-typed against ApiError from @workspace/api-client-react's custom-fetch
// (not re-exported from the package, so we match its shape instead of importing it).
interface ApiErrorLike {
  status?: number;
  data?: { error?: string } | null;
  message?: string;
}

/**
 * Returns a student-readable message when `err` is a 402 quota-exceeded
 * response from the API, or null for any other error.
 */
export function getQuotaErrorMessage(err: unknown): string | null {
  const apiErr = err as ApiErrorLike;
  if (apiErr?.status !== 402) return null;
  return apiErr.data?.error ?? apiErr.message ?? "You've reached your monthly limit for this feature.";
}
