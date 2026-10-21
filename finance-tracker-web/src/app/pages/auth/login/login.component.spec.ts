import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '@common/auth/auth.service';
import { Subject } from 'rxjs';
import { LoginComponent } from './login.component';

@Component({ template: '' })
class Blank {}

describe('LoginComponent', () => {
  let login$: Subject<void>;
  let auth: { login: ReturnType<typeof vi.fn> };

  async function setup(url = '/auth/login') {
    login$ = new Subject<void>();
    auth = { login: vi.fn(() => login$) };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        provideRouter(
          [
            { path: 'auth/login', component: LoginComponent },
            { path: '**', component: Blank },
          ],
          withComponentInputBinding(),
        ),
      ],
    });
    const harness = await RouterTestingHarness.create(url);
    const el = harness.routeNativeElement!;
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl');
    const input = (name: string) =>
      el.querySelector<HTMLInputElement>(`[formcontrolname=${name}]`)!;
    const type = async (name: string, value: string) => {
      input(name).value = value;
      input(name).dispatchEvent(new Event('input'));
      await harness.fixture.whenStable();
    };
    const submit = async () => {
      el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
      await harness.fixture.whenStable();
    };
    return { harness, el, navigate, input, type, submit };
  }

  it('has labelled email and password fields and a link to register', async () => {
    const { el } = await setup();
    const labels = Array.from(el.querySelectorAll('mat-label')).map((l) => l.textContent);
    expect(labels).toEqual(['Email', 'Password']);
    expect(el.querySelector('a[href="/auth/register"]')?.textContent).toBe('Create an account');
  });

  it('validates inline and does not call the API when invalid', async () => {
    const { el, submit, input } = await setup();
    await submit();
    expect(auth.login).not.toHaveBeenCalled();
    const errors = Array.from(el.querySelectorAll('mat-error')).map((e) => e.textContent?.trim());
    expect(errors).toEqual(['Enter your email.', 'Enter your password.']);
    expect(document.activeElement).toBe(input('email'));
  });

  it('shows a loading state while logging in, then returns to returnUrl', async () => {
    const { el, type, submit, navigate, harness } = await setup(
      '/auth/login?returnUrl=%2Ftransactions%3Fmonth%3D2026-10',
    );
    await type('email', 'kasia@example.com');
    await type('password', 'kasia2026');
    await submit();

    expect(auth.login).toHaveBeenCalledWith({ email: 'kasia@example.com', password: 'kasia2026' });
    const button = el.querySelector<HTMLButtonElement>('button[type=submit]')!;
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.textContent).toContain('Logging in…');

    login$.next();
    login$.complete();
    await harness.fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith('/transactions?month=2026-10');
  });

  it('keeps focus on the submit button while logging in and ignores a second submit', async () => {
    const { el, type, submit } = await setup();
    await type('email', 'kasia@example.com');
    await type('password', 'kasia2026');
    const button = el.querySelector<HTMLButtonElement>('button[type=submit]')!;
    button.focus();
    await submit();

    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(button);

    await submit();
    expect(auth.login).toHaveBeenCalledTimes(1);
  });

  it('never redirects outside the app after login', async () => {
    const { type, submit, navigate } = await setup('/auth/login?returnUrl=https:%2F%2Fevil.com');
    await type('email', 'kasia@example.com');
    await type('password', 'kasia2026');
    await submit();
    login$.next();
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('says "Email or password is incorrect." on 401', async () => {
    const { el, type, submit, harness } = await setup();
    await type('email', 'kasia@example.com');
    await type('password', 'wrong');
    await submit();
    login$.error(new HttpErrorResponse({ status: 401 }));
    await harness.fixture.whenStable();
    const alert = el.querySelector('[role=alert]');
    expect(alert?.textContent?.trim()).toBe('Email or password is incorrect.');
    expect(el.querySelector('button[type=submit]')!.hasAttribute('aria-disabled')).toBe(false);
  });

  it('shows a generic error for other failures', async () => {
    const { el, type, submit, harness } = await setup();
    await type('email', 'kasia@example.com');
    await type('password', 'kasia2026');
    await submit();
    login$.error(new HttpErrorResponse({ status: 0 }));
    await harness.fixture.whenStable();
    expect(el.querySelector('[role=alert]')?.textContent?.trim()).toBe(
      'Something went wrong. Try again.',
    );
  });

  it('pre-fills the email from the query string', async () => {
    const { input } = await setup('/auth/login?email=kasia%40example.com');
    expect(input('email').value).toBe('kasia@example.com');
  });

  it('toggles password visibility', async () => {
    const { el, input, harness } = await setup();
    const toggle = el.querySelector<HTMLButtonElement>('button[aria-label="Show password"]')!;
    expect(input('password').type).toBe('password');
    toggle.click();
    await harness.fixture.whenStable();
    expect(input('password').type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });
});
