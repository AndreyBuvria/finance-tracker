import { Component, computed, DestroyRef, inject } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '@common/auth/auth.service';
import { AppRoutesEnum } from '@common/routing/app-routes.enum';
import { AppLayoutComponent } from '@infrastructure/layout/app-layout.component';
import { NavItem } from '@infrastructure/layout/navigation.model';

/**
 * Route component that wraps every authenticated page in the app layout.
 * Lives at the app root because it composes infrastructure (layout) with app-wide services.
 *
 * `(addRequested)` is intentionally not bound yet: where the Quick-add dialog lives is an open
 * question (CLAUDE.md "Feature used across pages"). Bind it here once that is decided.
 */
@Component({
  selector: 'app-authenticated-layout',
  imports: [AppLayoutComponent, RouterOutlet],
  template: `
    <app-layout [navItems]="navItems" [userName]="userName()" (logoutRequested)="logout()">
      <router-outlet />
    </app-layout>
  `,
})
export class AuthenticatedLayoutComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly navItems: readonly NavItem[] = [
    {
      path: AppRoutesEnum.Dashboard,
      label: $localize`:@@nav.dashboard:Dashboard`,
      icon: 'dashboard',
    },
    {
      path: AppRoutesEnum.Transactions,
      label: $localize`:@@nav.transactions:Transactions`,
      icon: 'receipt_long',
    },
    {
      path: AppRoutesEnum.Accounts,
      label: $localize`:@@nav.accounts:Accounts`,
      icon: 'account_balance_wallet',
    },
    { path: AppRoutesEnum.Settings, label: $localize`:@@nav.settings:Settings`, icon: 'settings' },
  ];

  /** Current user for the avatar menu. If it can't be loaded, the layout shows a generic avatar. */
  private readonly me = rxResource({ stream: () => this.auth.me() });
  readonly userName = computed(() => (this.me.hasValue() ? this.me.value().displayName : ''));

  logout(): void {
    this.auth
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.router.navigateByUrl(AppRoutesEnum.Login));
  }
}
