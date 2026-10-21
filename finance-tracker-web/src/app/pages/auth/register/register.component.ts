import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@common/auth/auth.service';
import { AppRoutesEnum } from '@common/routing/app-routes.enum';
import { finalize } from 'rxjs';
import { AuthCardComponent } from '../common/auth-card/auth-card.component';
import { PasswordChecklistComponent } from './password-checklist/password-checklist.component';
import { PreventWhitespaceDirective } from '../common/prevent-whitespace/prevent-whitespace.directive';
import { notBlankValidator } from '../utils/not-blank.utils';
import { passwordRulesValidator } from '../utils/password.utils';
import { validationErrors } from '../utils/problem-details.utils';

type RegisterError = 'duplicateEmail' | 'generic';

/** Create an account (FEATURES.md F1). On success the user is logged in. */
@Component({
  selector: 'app-register',
  imports: [
    AuthCardComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    PasswordChecklistComponent,
    PreventWhitespaceDirective,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './register.component.html',
  styleUrl: '../common/auth-form.scss',
})
export class RegisterComponent {
  protected readonly routes = AppRoutesEnum;

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly form = inject(NonNullableFormBuilder).group({
    displayName: ['', notBlankValidator],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, passwordRulesValidator]],
  });

  /** Drives the live checklist while typing. */
  readonly password = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });

  readonly submitting = signal(false);
  readonly error = signal<RegisterError | null>(null);
  /** Email that was rejected as a duplicate, passed on to the login page. */
  readonly duplicateEmail = signal('');
  readonly passwordVisible = signal(false);

  submit(): void {
    if (this.submitting()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    const request = this.form.getRawValue();
    this.auth
      .register({ ...request, displayName: request.displayName.trim() })
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        // Onboarding (first login) is a separate task; until then new users land on the dashboard.
        next: () => void this.router.navigateByUrl(AppRoutesEnum.Dashboard),
        error: (error: unknown) => this.handleError(error, request.email),
      });
  }

  private handleError(error: unknown, email: string): void {
    if (error instanceof HttpErrorResponse && error.status === 409) {
      this.duplicateEmail.set(email);
      this.error.set('duplicateEmail');
      return;
    }
    const fieldErrors = Object.entries(validationErrors(error)).filter(
      ([field]) => field in this.form.controls,
    );
    if (fieldErrors.length === 0) {
      this.error.set('generic');
      return;
    }
    for (const [field, message] of fieldErrors) {
      this.form.get(field)?.setErrors({ server: message });
    }
    this.focusFirstInvalid();
  }

  private focusFirstInvalid(): void {
    this.host.nativeElement.querySelector<HTMLElement>('input.ng-invalid')?.focus();
  }
}
