import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { categoryOnColor } from '@common/categories/category-color.utils';
import { errorId } from '@common/http/problem-details.utils';
import { LoadErrorComponent } from '@infrastructure/feedback/load-error/load-error.component';
import { finalize } from 'rxjs';
import { OnboardingBudgetsService } from '../onboarding-budgets.service';

/**
 * Onboarding step 2, "Set a monthly budget" (FEATURES.md F1, DESIGN.md "Onboarding"): Groceries,
 * Eating out, Transport, Shopping and Entertainment, each with its icon and an empty "zł" limit.
 * Continue saves the filled-in limits for the current month and reports `continued`; "Skip" (in
 * the page's top corner) saves nothing.
 */
@Component({
  selector: 'app-budget-step',
  imports: [
    LoadErrorComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
  ],
  templateUrl: './budget-step.component.html',
  styleUrl: './budget-step.component.scss',
})
export class BudgetStepComponent {
  readonly continued = output<void>();
  readonly back = output<void>();

  protected readonly budgets = inject(OnboardingBudgetsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly form = this.budgets.form;
  readonly rows = computed(() => (this.budgets.rows.hasValue() ? this.budgets.rows.value() : []));
  readonly loadErrorId = computed(() => errorId(this.budgets.rows.error()));

  readonly saving = signal(false);
  readonly error = signal<'generic' | null>(null);

  onColor(color: string): string {
    return categoryOnColor(color);
  }

  submit(): void {
    if (this.saving()) {
      return;
    }
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }
    this.saving.set(true);
    this.budgets
      .save()
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.continued.emit(),
        error: () => {
          if (this.form.invalid) {
            this.focusFirstInvalid();
          } else {
            this.error.set('generic');
          }
        },
      });
  }

  private focusFirstInvalid(): void {
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>('input.ng-invalid')?.focus(),
      { injector: this.injector },
    );
  }
}
