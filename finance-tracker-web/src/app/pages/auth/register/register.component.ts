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
import {
  DISPLAY_NAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../common/auth-limits.constants';
import { notBlankValidator } from '@common/forms/not-blank.utils';
import { passwordLetterAndNumberValidator } from '../utils/password.utils';
import { validationErrors } from '@common/http/problem-details.utils';
import { trimmedMaxLengthValidator } from '@common/forms/trimmed-max-length.utils';

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

  // Messages and their order match the API validators (PLAN.md §7 "Auth contract (agreed)").
  // No `maxlength` attributes: the browser would silently cut pasted text instead of explaining.
  readonly form = inject(NonNullableFormBuilder).group({
    displayName: ['', [notBlankValidator, trimmedMaxLengthValidator(DISPLAY_NAME_MAX_LENGTH)]],
    email: ['', [Validators.required, Validators.maxLength(EMAIL_MAX_LENGTH), Validators.email]],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(PASSWORD_MIN_LENGTH),
        Validators.maxLength(PASSWORD_MAX_LENGTH),
        passwordLetterAndNumberValidator,
      ],
    ],
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
        // A new user always starts with onboarding (FEATURES.md F1).
        next: () => void this.router.navigateByUrl(AppRoutesEnum.Onboarding),
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
