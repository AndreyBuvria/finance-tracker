import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { safeReturnUrl } from '../utils/return-url.utils';

type LoginError = 'credentials' | 'generic';

/** Log in (FEATURES.md F1). After login, returns to `returnUrl` (or the dashboard). */
@Component({
  selector: 'app-login',
  imports: [
    AuthCardComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './login.component.html',
  styleUrl: '../common/auth-form.scss',
})
export class LoginComponent implements OnInit {
  protected readonly routes = AppRoutesEnum;

  /** Query param: page to return to after login. */
  readonly returnUrl = input<string>();
  /** Query param: pre-filled email (e.g. from "Log in instead?" on the register page). */
  readonly email = input<string>();

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  readonly submitting = signal(false);
  readonly error = signal<LoginError | null>(null);
  readonly passwordVisible = signal(false);

  ngOnInit(): void {
    const email = this.email();
    if (email) {
      this.form.controls.email.setValue(email);
    }
  }

  submit(): void {
    if (this.submitting()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.host.nativeElement.querySelector<HTMLElement>('input.ng-invalid')?.focus();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.auth
      .login(this.form.getRawValue())
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => void this.router.navigateByUrl(safeReturnUrl(this.returnUrl())),
        error: (error: unknown) =>
          this.error.set(
            error instanceof HttpErrorResponse && error.status === 401 ? 'credentials' : 'generic',
          ),
      });
  }
}
