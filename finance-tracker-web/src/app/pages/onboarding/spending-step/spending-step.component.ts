import { Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/** The two choices that finish onboarding. */
type Choice = 'addManually' | 'later';

/**
 * Onboarding step 3, "Add your spending" (FEATURES.md F1, DESIGN.md "Onboarding"): two large
 * options, "Import a bank statement (CSV)" (disabled, "Coming soon" until Phase 4) and "Add a
 * transaction manually", plus the quieter "I'll do it later". Both active choices finish
 * onboarding; the page does that and reports a failure through `error`.
 */
@Component({
  selector: 'app-spending-step',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    @if (error()) {
      <p class="form-error" role="alert">
        <ng-container i18n="@@common.error.generic">Something went wrong. Try again.</ng-container>
      </p>
    }
    <div role="status" class="visually-hidden">
      @if (busy()) {
        <span i18n="@@common.action.saving">Saving…</span>
      }
    </div>

    <div class="options">
      <!-- Focusable but inert, so screen reader users still find it; the badge is in its name. -->
      <button type="button" class="option" aria-disabled="true">
        <mat-icon class="option-icon" aria-hidden="true">upload_file</mat-icon>
        <span class="option-title" i18n="@@onboarding.spending.import"
          >Import a bank statement (CSV)</span
        >
        <span class="badge" i18n="@@common.badge.comingSoon">Coming soon</span>
      </button>
      <button
        type="button"
        class="option primary"
        [attr.aria-disabled]="busy() || null"
        (click)="choose('addManually')"
      >
        <mat-icon class="option-icon" aria-hidden="true">edit_note</mat-icon>
        <span class="option-title" i18n="@@onboarding.spending.manual"
          >Add a transaction manually</span
        >
        @if (saving() === 'addManually') {
          <span class="saving">
            <mat-progress-spinner mode="indeterminate" diameter="20" aria-hidden="true" />
            <span i18n="@@common.action.saving">Saving…</span>
          </span>
        }
      </button>
    </div>

    <div class="actions">
      <button
        matButton
        type="button"
        class="back"
        disabledInteractive
        [disabled]="busy()"
        (click)="goBack()"
      >
        <span i18n="@@onboarding.action.back">Back</span>
      </button>
      <button
        matButton
        type="button"
        class="later"
        disabledInteractive
        [disabled]="busy()"
        (click)="choose('later')"
      >
        @if (saving() === 'later') {
          <mat-progress-spinner mode="indeterminate" diameter="20" aria-hidden="true" />
          <span i18n="@@common.action.saving">Saving…</span>
        } @else {
          <span i18n="@@onboarding.spending.later">I'll do it later</span>
        }
      </button>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: 16px;
    }

    .form-error {
      margin: 0;
      color: var(--mat-sys-error);
    }

    .options {
      display: grid;
      gap: 12px;
    }

    .option {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px 16px;
      width: 100%;
      min-height: 88px;
      padding: 16px 20px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-large);
      background: var(--mat-sys-surface-container-low);
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-title-medium);
      text-align: start;
      cursor: pointer;

      &:hover:not([aria-disabled='true']) {
        background: var(--mat-sys-surface-container);
      }

      &[aria-disabled='true'] {
        cursor: default;
        color: var(--mat-sys-on-surface-variant);
      }

      &.primary {
        border-color: var(--mat-sys-primary);
      }
    }

    .option-icon {
      width: 32px;
      height: 32px;
      font-size: 32px;
      color: var(--mat-sys-primary);
    }

    [aria-disabled='true'] .option-icon {
      color: var(--mat-sys-on-surface-variant);
    }

    .option-title {
      flex: 1;
      min-width: 160px;
    }

    .badge {
      padding: 2px 8px;
      border-radius: var(--mat-sys-corner-small);
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      font: var(--mat-sys-label-medium);
    }

    .saving {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font: var(--mat-sys-label-large);
    }

    .actions {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
  `,
})
export class SpendingStepComponent {
  /** Onboarding is being completed: the choices wait. */
  readonly busy = input(false);
  /** Completing failed for an unexpected reason. */
  readonly error = input(false);

  readonly addManually = output<void>();
  readonly later = output<void>();
  readonly back = output<void>();

  /** The option last chosen; while busy it shows "Saving…". */
  private readonly chosen = signal<Choice | null>(null);
  readonly saving = computed(() => (this.busy() ? this.chosen() : null));

  /** Back to step 2, but not while onboarding is being completed. */
  goBack(): void {
    if (!this.busy()) {
      this.back.emit();
    }
  }

  choose(choice: Choice): void {
    if (this.busy()) {
      return;
    }
    this.chosen.set(choice);
    if (choice === 'addManually') {
      this.addManually.emit();
    } else {
      this.later.emit();
    }
  }
}
