import { AppRoutesEnum } from '@common/routing/app-routes.enum';

/**
 * Where to go after login. Only same-app paths are allowed (no open redirects to other sites),
 * and never back to an auth page.
 */
export function safeReturnUrl(returnUrl: string | null | undefined): string {
  if (
    !returnUrl ||
    !returnUrl.startsWith('/') ||
    returnUrl.startsWith('//') ||
    returnUrl.startsWith('/\\') ||
    returnUrl.startsWith(AppRoutesEnum.Auth)
  ) {
    return AppRoutesEnum.Dashboard;
  }
  return returnUrl;
}
