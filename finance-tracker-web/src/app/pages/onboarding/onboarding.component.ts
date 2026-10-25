import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { AuthService } from '@common/auth/auth.service';
import { problemDetail } from '@common/http/problem-details.utils';
import { AppRoutesEnum } from '@common/routing/app-routes.enum';
import { ADD_INTENT_PARAM, ADD_INTENT_VALUE } from '@common/routing/route-intents.constants';
import { finalize } from 'rxjs';
import { AccountsStepComponent } from './accounts-step/accounts-step.component';
import { BudgetStepComponent } from './budget-step/budget-step.component';
import {
  ONBOARDING_STEP_COUNT,
  OnboardingStep,
} from './common/constants/onboarding-steps.constants';
import { OnboardingAccountsService } from './onboarding-accounts.service';
import { OnboardingBudgetsService } from './onboarding-budgets.service';
import { SpendingStepComponent } from './spending-step/spending-step.component';

/** Where to go once onboarding is finished. */
type Destination = 'addTransaction' | 'dashboard';

/**
 * Onboarding, first login only (FEATURES.md F1, DESIGN.md "Onboarding"): 3 steps with progress
 * dots; step 1 (accounts) is required, step 2 (budgets) can be skipped with "Skip" in the top
 * corner, step 3 finishes. Finishing calls `POST /me/onboarding/complete`, then opens Quick add on
 * the Transactions page or the Dashboard. The steps keep their state when the user goes back
 * (page-scoped services). Each step change moves focus to the step heading. A small "Log out"
 * link stays in the top bar throughout.
 */
@Component({
  selector: 'app-onboarding',
  imports: [AccountsStepComponent, BudgetStepComponent, MatButtonModule, SpendingStepComponent],
  providers: [OnboardingAccountsService, OnboardingBudgetsService],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss',
})
export class OnboardingComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly accounts = inject(OnboardingAccountsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');

  protected readonly stepCount = ONBOARDING_STEP_COUNT;
  protected readonly stepNumbers: readonly OnboardingStep[] = [1, 2, 3];

  readonly step = signal<OnboardingStep>(1);
  /** Shown on step 1 when completing failed because there is no account (409). */
  readonly accountsNotice = signal<string | null>(null);
  readonly completing = signal(false);
  readonly completeFailed = signal(false);
  readonly loggingOut = signal(false);

  goTo(step: OnboardingStep): void {
    this.step.set(step);
    afterNextRender(() => this.heading().nativeElement.focus(), { injector: this.injector });
  }

  accountsSaved(): void {
    this.accountsNotice.set(null);
    this.goTo(2);
  }

  finish(destination: Destination): void {
    if (this.completing()) {
      return;
    }
    this.completing.set(true);
    this.completeFailed.set(false);
    this.auth
      .completeOnboarding()
      .pipe(
        finalize(() => this.completing.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => void this.navigate(destination),
        error: (error: unknown) => {
          const notice = problemDetail(error, 409);
          if (notice) {
            // "Add at least one account first.": the accounts are gone (e.g. archived elsewhere).
            this.accountsNotice.set(notice);
            this.accounts.resync();
            this.goTo(1);
          } else {
            this.completeFailed.set(true);
          }
        },
      });
  }

  /** "Log out" (FEATURES.md F1): ends the session like the account menu, then shows login. */
  logout(): void {
    if (this.loggingOut()) {
      return;
    }
    this.loggingOut.set(true);
    this.auth
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.router.navigateByUrl(AppRoutesEnum.Login));
  }

  private navigate(destination: Destination): Promise<boolean> {
    return destination === 'addTransaction'
      ? this.router.navigate([AppRoutesEnum.Transactions], {
          queryParams: { [ADD_INTENT_PARAM]: ADD_INTENT_VALUE },
        })
      : this.router.navigateByUrl(AppRoutesEnum.Dashboard);
  }
}
