export function safeErrorDetails(error: unknown): Record<string, string | number> {
  const details: Record<string, string | number> = {};
  const safeLabel = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;

  if (error instanceof Error && safeLabel.test(error.name)) {
    details.name = error.name;
  }

  if (typeof error === "object" && error !== null) {
    const candidate = error as { code?: unknown; status?: unknown; statusCode?: unknown };

    if (typeof candidate.status === "number" && Number.isFinite(candidate.status)) {
      details.status = candidate.status;
    } else if (typeof candidate.statusCode === "number" && Number.isFinite(candidate.statusCode)) {
      details.status = candidate.statusCode;
    }

    if (typeof candidate.code === "string" && safeLabel.test(candidate.code)) {
      details.code = candidate.code;
    }
  }

  return details;
}