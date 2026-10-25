import { hasStatus, problemDetail, validationErrors } from '@common/http/problem-details.utils';

/**
 * Message for a failed `POST /transactions/bulk` (bulk actions and the inline category change):
 * - 400: the API's validation message (e.g. "Transfers don't have a category. Unselect them first.");
 * - 404: the API's `detail` (e.g. "This category doesn't exist." for a deleted category), else that
 *   the selected transactions, or for one row that the transaction, no longer exist;
 * - otherwise the generic message.
 */
export function bulkErrorMessage(error: unknown, singleRow = false): string {
  if (hasStatus(error, 404)) {
    return (
      problemDetail(error, 404) ??
      (singleRow
        ? $localize`:@@transactions.error.oneNotFound:This transaction doesn't exist. Refresh the list and try again.`
        : $localize`:@@transactions.error.someNotFound:One or more of the selected transactions don't exist. Refresh the list and try again.`)
    );
  }
  return (
    Object.values(validationErrors(error))[0] ??
    $localize`:@@common.error.generic:Something went wrong. Try again.`
  );
}
