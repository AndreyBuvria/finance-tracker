import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '@common/auth/auth.service';
import { Subject } from 'rxjs';
import { RegisterComponent } from './register.component';

@Component({ template: '' })
class Blank {}

describe('RegisterComponent', () => {
  let register$: Subject<void>;
  let auth: { register: ReturnType<typeof vi.fn> };

  async function setup() {
    register$ = new Subject<void>();
    auth = { register: vi.fn(() => register$) };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        provideRouter([
          { path: 'auth/register', component: RegisterComponent },
          { path: '**', component: Blank },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create('/auth/register');
    const el = harness.routeNativeElement!;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
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
    const fillValid = async () => {
      await type('displayName', ' Kasia ');
      await type('email', 'kasia@example.com');
      await type('password', 'kasia2026');
    };
    const met = () =>
      Array.from(el.querySelectorAll('app-password-checklist li')).map((li) =>
        li.classList.contains('met'),
      );
    return { harness, el, navigate, input, type, submit, fillValid, met };
  }

  it('has labelled display name, email and password fields', async () => {
    const { el, input } = await setup();
    const labels = Array.from(el.querySelectorAll('mat-label')).map((l) => l.textContent);
    expect(labels).toEqual(['Display name', 'Email', 'Password']);
    expect(input('password').getAttribute('aria-describedby')).toContain('password-rules');
    expect(el.querySelector('#password-rules')).toBeTruthy();
  });

  it('ticks the password checklist off live while typing', async () => {
    const { type, met } = await setup();
    expect(met()).toEqual([false, false, false]);
    await type('password', 'k');
    expect(met()).toEqual([false, true, false]);
    await type('password', 'kasia202');
    expect(met()).toEqual([true, true, true]);
    await type('password', '12345678');
    expect(met()).toEqual([true, false, true]);
  });

  it('validates inline and does not call the API when invalid', async () => {
    const { el, type, submit } = await setup();
    await type('email', 'not-an-email');
    await type('password', 'short');
    await submit();
    expect(auth.register).not.toHaveBeenCalled();
    const errors = Array.from(el.querySelectorAll('mat-error')).map((e) => e.textContent?.trim());
    expect(errors).toEqual([
      'Enter your name.',
      'Enter a valid email address.',
      "Your password doesn't meet all the requirements.",
    ]);
  });

  it('does not accept a whitespace-only display name', async () => {
    const { el, input, type, submit, harness } = await setup();
    await type('displayName', '   ');
    expect(input('displayName').value).toBe('');
    await type('email', 'kasia@example.com');
    await type('password', 'kasia2026');
    await submit();
    expect(auth.register).not.toHaveBeenCalled();
    expect(el.querySelector('mat-error')?.textContent?.trim()).toBe('Enter your name.');
    expect(document.activeElement).toBe(input('displayName'));

    // A blank value that bypasses typing (e.g. autofill) is still rejected.
    const form = (harness.routeDebugElement!.componentInstance as RegisterComponent).form;
    form.controls.displayName.setValue(' \u00a0 ');
    await submit();
    expect(auth.register).not.toHaveBeenCalled();
    expect(el.querySelector('mat-error')?.textContent?.trim()).toBe('Enter your name.');
  });

  it('registers with a trimmed name, shows a loading state and goes to the dashboard', async () => {
    const { el, fillValid, submit, navigate, harness } = await setup();
    await fillValid();
    await submit();
    expect(auth.register).toHaveBeenCalledWith({
      displayName: 'Kasia',
      email: 'kasia@example.com',
      password: 'kasia2026',
    });
    const button = el.querySelector<HTMLButtonElement>('button[type=submit]')!;
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.textContent).toContain('Creating account…');

    register$.next();
    await harness.fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('keeps focus on the submit button while sending and ignores a second submit', async () => {
    const { el, fillValid, submit } = await setup();
    await fillValid();
    const button = el.querySelector<HTMLButtonElement>('button[type=submit]')!;
    button.focus();
    await submit();

    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(button);

    await submit();
    expect(auth.register).toHaveBeenCalledTimes(1);
  });

  it('offers to log in instead when the email is taken (409)', async () => {
    const { el, fillValid, submit, harness } = await setup();
    await fillValid();
    await submit();
    register$.error(new HttpErrorResponse({ status: 409 }));
    await harness.fixture.whenStable();

    const alert = el.querySelector('[role=alert]')!;
    expect(alert.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'An account with this email already exists. Log in instead?',
    );
    const link = alert.querySelector('a')!;
    expect(link.textContent?.trim()).toBe('Log in instead?');
    expect(link.getAttribute('href')).toBe('/auth/login?email=kasia@example.com');
    expect(el.querySelector('button[type=submit]')!.hasAttribute('aria-disabled')).toBe(false);
  });

  it('shows server validation messages on the matching fields (400)', async () => {
    const { el, fillValid, submit, harness } = await setup();
    await fillValid();
    await submit();
    register$.error(
      new HttpErrorResponse({
        status: 400,
        error: { errors: { Email: ['Email is not allowed.'] } },
      }),
    );
    await harness.fixture.whenStable();
    expect(el.querySelector('mat-error')?.textContent?.trim()).toBe('Email is not allowed.');
    expect(el.querySelector('[role=alert]')).toBeNull();
  });

  it('shows a generic error for other failures', async () => {
    const { el, fillValid, submit, harness } = await setup();
    await fillValid();
    await submit();
    register$.error(new HttpErrorResponse({ status: 500 }));
    await harness.fixture.whenStable();
    expect(el.querySelector('[role=alert]')?.textContent?.trim()).toBe(
      'Something went wrong. Try again.',
    );
  });

  it('links to the login page', async () => {
    const { el } = await setup();
    expect(el.querySelector('.switch a')?.getAttribute('href')).toBe('/auth/login');
  });
});
