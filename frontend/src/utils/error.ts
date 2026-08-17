// src/utils/error.ts

/**
 * Extracts a safe, human-readable string message from any error object or response.
 * Guarantees that an object is never returned, preventing React error #31.
 */
export function getErrorMessage(err: unknown, fallback = 'Unable to load your financial data from server.'): string {
  if (!err) {
    return fallback;
  }

  if (typeof err === 'string') {
    return err;
  }

  if (typeof err === 'object') {
    const anyErr = err as any;

    // Axios error response data
    if (anyErr.response?.data) {
      const data = anyErr.response.data;
      if (typeof data === 'string') {
        return data;
      }
      if (data && typeof data === 'object') {
        if (typeof data.error === 'string') {
          return data.error;
        }
        if (typeof data.message === 'string') {
          return data.message;
        }
        if (typeof data.error?.message === 'string') {
          return data.error.message;
        }
      }
    }

    if (typeof anyErr.message === 'string') {
      return anyErr.message;
    }
  }

  try {
    return String(err);
  } catch {
    return fallback;
  }
}
