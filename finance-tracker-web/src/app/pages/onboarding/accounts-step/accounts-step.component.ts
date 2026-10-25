import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { errorId, problemDetail } from '@common/http/problem-details.utils';
import { LoadErrorComponent } from '@infrastructure/feedback/load-error/load-error.component';
import { finalize, startWith } from 'rxjs';
import { OnboardingAccountsService } from '../onboarding-accounts.service';
import { AccountSuggestionFieldsComponent } from './account-suggestion-fields/account-suggestion-fields.component';

/**
 * Onboarding step 1, "Where do you keep your money?" (FEATURES.md F1, DESIGN.md "Onboarding"):
 * toggle chips Main card / Savings / Cash; each selected one expands to its name and an optional
 * current balance. At least one is required, so Continue stays disabled until one is selected.
 * Continue saves the accounts (see `OnboardingAccountsService`) and reports `continued`.
 */
@Component({
  selector: 'app-accounts-step',
  imports: [
    AccountSuggestionFieldsComponent,
    LoadErrorComponent,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
  ],
  templateUrl: './accounts-step.component.html',
  styleUrl: './accounts-step.component.scss',
})
export class AccountsStepComponent {
  /** ID of the step heading, which labels the chips. */
  readonly labelledBy = input.required<string>();
  /** A message from completing onboarding, e.g. "Add at least one account first." */
  readonly notice = input<string | null>(null);

  readonly continued = output<void>();

  protected readonly accounts = inject(OnboardingAccountsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly form = this.accounts.form;

  private readonly selected = toSignal(
    this.form.controls.selected.valueChanges.pipe(startWith(this.form.controls.selected.value)),
    { requireSync: true },
  );
  readonly selectedSuggestions = computed(() => this.accounts.selectedSuggestions(this.selected()));
  readonly noneSelected = computed(() => this.selected().length === 0);
  readonly loadErrorId = computed(() => errorId(this.accounts.existing.error()));

  readonly saving = signal(false);
  /** A form-level error: an API message without a field (e.g. an archive 409), or `generic`. */
  readonly error = signal<{ message: string } | 'generic' | null>(null);

  submit(): void {
    if (this.saving() || this.noneSelected()) {
      return;
    }
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }
    this.saving.set(true);
    this.accounts
      .save()
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.continued.emit(),
        error: (error: unknown) => {
          if (this.form.invalid) {
            this.focusFirstInvalid();
            return;
          }
          // E.g. archiving a deselected account: "You need at least one active account."
          const message = problemDetail(error, 409);
          this.error.set(message ? { message } : 'generic');
        },
      });
  }

  /**
   * Focuses the first invalid field once the error state is rendered (after a server error the
   * `ng-invalid` classes only appear on the next render).
   */
  private focusFirstInvalid(): void {
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>('input.ng-invalid')?.focus(),
      { injector: this.injector },
    );
  }
}
