import { ApiError } from '@/api/client';

export function getUserFacingError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 429:
        return 'Too many requests right now. Please wait a few seconds and try again.';

      case 503:
        return 'The service is temporarily unavailable. Please try again shortly.';

      case 400:
        return 'The request could not be completed. Please check your input and try again.';

      case 409:
        if (error.code === 'version_conflict') {
          return 'This asset was changed by someone else. The latest version needs to be reviewed before applying your change again.';
        }

        return 'This asset was changed by someone else. Please refresh and try again.';

      case 422:
        return 'The request could not be processed. Please review the asset details and try again.';

      default:
        return fallback;
    }
  }

  if (error instanceof TypeError) {
    return 'We could not reach the service. Check your connection and try again.';
  }

  return fallback;
}

export function getBulkFailureMessage(
  code: string,
  fallback = 'The asset could not be updated.',
): string {
  switch (code) {
    case 'legal_hold':
      return 'This asset is on legal hold and cannot be changed.';

    case 'conflict':
    case 'version_conflict':
      return 'The asset could not be updated because it was changed by someone else.';

    case 'not_found':
      return 'This asset could not be found. It may have been removed.';

    case 'upstream_unavailable':
      return 'The service is temporarily unavailable. Please try again shortly.';

    case 'rate_limited':
      return 'Too many requests right now. Please wait a few seconds and try again.';

    default:
      return fallback;
  }
}