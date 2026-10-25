import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Account, AccountRequest } from '@common/accounts/account.model';
import { AccountsApiService } from '@common/accounts/accounts-api.service';
import { AuthService } from '@common/auth/auth.service';
import { CategoriesApiService } from '@common/categories/categories-api.service';
import { CategoryTypeEnum } from '@common/categories/category-type.enum';
import { provideAppLocale } from '@common/locale/locale.utils';
import { provideFakeClock } from '@common/time/testing/fake-clock.service';
import { Observable, of, Subject, throwError } from 'rxjs';
import { BudgetsApiService } from './common/budgets/budgets-api.service';
import { OnboardingComponent } from './onboarding.component';

const visible = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const CATEGORIES = [
  ['groceries', 'Groceries', 'shopping_cart', '#2e7d32'],
  ['eating_out', 'Eating out', 'restaurant', '#ef6c00'],
  ['transport', 'Transport', 'directions_bus', '#1565c0'],
  ['housing', 'Housing', 'home', '#6d4c41'],
  ['shopping', 'Shopping', 'shopping_bag', '#ad1457'],
  ['entertainment', 'Entertainment', 'movie', '#7b1fa2'],
].map(([systemKey, name, icon, color]) => ({
  id: `id-${systemKey}`,
  name,
  type: CategoryTypeEnum.Expense,
  icon,
  color,
  systemKey,
  isArchived: false,
  isProtected: false,
  transactionCount: 0,
  budgetCount: 0,
}));

interface SetupOptions {
  accounts?: () => Observable<{ items: Account[]; netWorth: number }>;
  complete?: () => Observable<void>;
  logout?: () => Observable<void>;
}

describe('OnboardingComponent', () => {
  async function setup(options: SetupOptions = {}) {
    let nextId = 0;
    const accountsApi = {
      list: vi.fn(options.accounts ?? (() => of({ items: [], netWorth: 0 }))),
      create: vi.fn((request: AccountRequest) =>
        of({ ...request, id: `a${++nextId}`, balance: 0, isArchived: false } as Account),
      ),
      update: vi.fn(),
      archive: vi.fn(() => of(undefined)),
    };
    const budgetsApi = { setLimit: vi.fn(() => of(null)) };
    const auth = {
      completeOnboarding: vi.fn(options.complete ?? (() => of(undefined))),
      logout: vi.fn(options.logout ?? (() => of(undefined))),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideAppLocale(),
        provideFakeClock('2026-10-19T10:00:00Z'),
        { provide: AccountsApiService, useValue: accountsApi },
        { provide: CategoriesApiService, useValue: { list: () => of({ items: CATEGORIES }) } },
        { provide: BudgetsApiService, useValue: budgetsApi },
        { provide: AuthService, useValue: auth },
      ],
    });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(OnboardingComponent);
    const el = fixture.nativeElement as HTMLElement;
    const stable = () => fixture.whenStable();
    await stable();

    const heading = () => el.querySelector<HTMLElement>('h1')!;
    const buttons = () => Array.from(el.querySelectorAll<HTMLButtonElement>('button'));
    const button = (text: string) => buttons().find((b) => visible(b.textContent) === text)!;
    const chip = (text: string) =>
      Array.from(el.querySelectorAll<HTMLElement>('mat-chip-option [role="option"]')).find(
        (option) => visible(option.textContent).endsWith(text),
      )!;
    const input = (label: string, index = 0) => {
      const fields = Array.from(el.querySelectorAll('mat-form-field')).filter(
        (field) => visible(field.querySelector('mat-label')?.textContent) === label,
      );
      return fields[index].querySelector('input')!;
    };
    const type = (target: HTMLInputElement, value: string) => {
      target.value = value;
      target.dispatchEvent(new Event('input'));
    };
    /** Selects chips and continues to step 2. */
    const finishStep1 = async (...chips: string[]) => {
      chips.forEach((text) => chip(text).click());
      await stable();
      button('Continue').click();
      await stable();
    };
    return {
      fixture,
      el,
      stable,
      heading,
      button,
      chip,
      input,
      type,
      finishStep1,
      accountsApi,
      budgetsApi,
      auth,
      navigate,
      navigateByUrl,
    };
  }

  describe('step 1: accounts', () => {
    it('asks where the money is, with the three suggestions and no Skip', async () => {
      const { el, heading, button } = await setup();
      expect(visible(heading().textContent)).toBe('Where do you keep your money?');
      expect(visible(el.querySelector('.step-count')?.textContent)).toBe('Step 1 of 3');
      const options = Array.from(el.querySelectorAll('mat-chip-option')).map((o) =>
        visible(o.textContent),
      );
      expect(options).toEqual(['credit_card Main card', 'savings Savings', 'wallet Cash']);
      const chips = el.querySelector('mat-chip-listbox')!;
      expect(chips.getAttribute('aria-labelledby')).toBe(heading().id);
      expect(chips.getAttribute('aria-required')).toBe('true');
      expect(button('Skip')).toBeUndefined();
    });

    it('keeps Continue disabled until an account is selected, and explains why', async () => {
      const { el, button, chip, stable, accountsApi } = await setup();
      const hint = el.querySelector('#accounts-required');
      expect(visible(hint?.textContent)).toBe('Choose at least one to continue.');
      expect(button('Continue').getAttribute('aria-disabled')).toBe('true');
      expect(button('Continue').getAttribute('aria-describedby')).toBe('accounts-required');
      button('Continue').click();
      await stable();
      expect(accountsApi.create).not.toHaveBeenCalled();

      chip('Savings').click();
      await stable();
      expect(button('Continue').hasAttribute('aria-disabled')).toBe(false);
      expect(el.querySelector('#accounts-required')).toBeNull();
    });

    it('expands a selected chip to its name and optional current balance', async () => {
      const { el, chip, stable, input } = await setup();
      chip('Main card').click();
      await stable();
      const fieldset = el.querySelector('fieldset')!;
      expect(visible(fieldset.querySelector('legend')?.textContent)).toBe('credit_card Main card');
      expect(input('Name').value).toBe('Main card');
      expect(input('Current balance').value).toBe('');
      expect(input('Current balance').placeholder).toBe('0,00');
      expect(visible(fieldset.querySelector('mat-hint')?.textContent)).toBe(
        'The balance on the day you start tracking. Check your bank app.',
      );
    });

    it('creates the accounts and moves to step 2 with focus on its heading', async () => {
      const { input, type, chip, stable, button, heading, accountsApi } = await setup();
      chip('Main card').click();
      await stable();
      type(input('Name'), 'mBank card');
      type(input('Current balance'), '2 340,15');
      button('Continue').click();
      await stable();
      expect(accountsApi.create).toHaveBeenCalledWith({
        name: 'mBank card',
        type: 'Card',
        currency: 'PLN',
        initialBalance: 2340.15,
      });
      expect(visible(heading().textContent)).toBe('Set a monthly budget');
      expect(document.activeElement).toBe(heading());
    });

    it('validates the name and balance before saving', async () => {
      const { chip, stable, input, type, button, el, accountsApi } = await setup();
      chip('Cash').click();
      await stable();
      type(input('Name'), '   ');
      type(input('Current balance'), '12,345');
      button('Continue').click();
      await stable();
      const errors = Array.from(el.querySelectorAll('mat-error')).map((e) =>
        visible(e.textContent),
      );
      expect(errors).toEqual([
        'Enter an account name.',
        'Enter an amount with at most 2 decimal places.',
      ]);
      expect(document.activeElement).toBe(input('Name'));
      expect(accountsApi.create).not.toHaveBeenCalled();
    });

    it('shows the message when archiving a deselected account fails (409)', async () => {
      const { finishStep1, chip, stable, button, el, accountsApi, heading } = await setup();
      await finishStep1('Main card');
      button('Back').click();
      await stable();
      accountsApi.archive.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: { detail: 'You need at least one active account.' },
            }),
        ),
      );
      chip('Main card').click();
      chip('Cash').click();
      await stable();
      button('Continue').click();
      await stable();
      expect(visible(el.querySelector('app-accounts-step [role="alert"]')?.textContent)).toBe(
        'You need at least one active account.',
      );
      expect(visible(heading().textContent)).toBe('Where do you keep your money?');
    });

    it('shows the duplicate-name message on the name', async () => {
      const { chip, stable, button, el, accountsApi, input } = await setup();
      accountsApi.create.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: { detail: 'An account with this name already exists.' },
            }),
        ),
      );
      chip('Savings').click();
      await stable();
      button('Continue').click();
      await stable();
      expect(visible(el.querySelector('mat-error')?.textContent)).toBe(
        'An account with this name already exists.',
      );
      expect(document.activeElement).toBe(input('Name'));
    });

    it('shows a skeleton while the accounts load, and offers to retry on failure', async () => {
      const pending = new Subject<{ items: Account[]; netWorth: number }>();
      let calls = 0;
      const { el, stable, fixture } = await setup({
        accounts: () =>
          ++calls === 1
            ? throwError(() => new HttpErrorResponse({ status: 500 }))
            : pending.asObservable(),
      });
      expect(el.querySelector('app-load-error [role="alert"]')).toBeTruthy();
      el.querySelector<HTMLButtonElement>('app-load-error button')!.click();
      // Not `whenStable()`: the reload stays pending. The first pass starts it, the second renders.
      fixture.detectChanges();
      fixture.detectChanges();
      expect(visible(el.querySelector('[role="status"]')?.textContent)).toBe('Loading accounts…');
      expect(el.querySelector('.skeleton')).toBeTruthy();
      pending.next({ items: [], netWorth: 0 });
      pending.complete();
      await stable();
      expect(el.querySelector('mat-chip-listbox')).toBeTruthy();
    });
  });

  describe('step 2: budgets', () => {
    it('shows the five categories with empty zł limits, the hint and Skip', async () => {
      const { el, finishStep1, button } = await setup();
      await finishStep1('Main card');
      expect(visible(el.querySelector('.hint')?.textContent)).toBe(
        'Not sure? Start with a guess. You can change it anytime.',
      );
      const fields = Array.from(el.querySelectorAll('app-budget-step mat-form-field'));
      expect(fields.map((f) => visible(f.querySelector('mat-label')?.textContent))).toEqual([
        'Groceries',
        'Eating out',
        'Transport',
        'Shopping',
        'Entertainment',
      ]);
      expect(fields.every((f) => f.querySelector('input')!.value === '')).toBe(true);
      expect(visible(fields[0].textContent)).toContain('zł');
      expect(visible(fields[0].querySelector('.category-icon')?.textContent)).toBe('shopping_cart');
      expect(button('Skip')).toBeTruthy();
    });

    it('saves the filled-in limits for the current month on Continue', async () => {
      const { finishStep1, input, type, button, stable, budgetsApi, heading } = await setup();
      await finishStep1('Main card');
      type(input('Groceries'), '1 200');
      type(input('Transport'), '150,50');
      button('Continue').click();
      await stable();
      expect(budgetsApi.setLimit.mock.calls).toEqual([
        ['id-groceries', '2026-10', 1200],
        ['id-transport', '2026-10', 150.5],
      ]);
      expect(visible(heading().textContent)).toBe('Add your spending');
    });

    it('rejects a negative limit', async () => {
      const { finishStep1, input, type, button, stable, el, budgetsApi } = await setup();
      await finishStep1('Main card');
      type(input('Shopping'), '-5');
      button('Continue').click();
      await stable();
      expect(visible(el.querySelector('mat-error')?.textContent)).toBe(
        'Enter an amount of 0 or more.',
      );
      expect(budgetsApi.setLimit).not.toHaveBeenCalled();
    });

    it('skips without saving anything', async () => {
      const { finishStep1, input, type, button, stable, budgetsApi, heading } = await setup();
      await finishStep1('Main card');
      type(input('Groceries'), '600');
      button('Skip').click();
      await stable();
      expect(budgetsApi.setLimit).not.toHaveBeenCalled();
      expect(visible(heading().textContent)).toBe('Add your spending');
      expect(document.activeElement).toBe(heading());
    });

    it('goes back to step 1 with its state, without creating accounts twice', async () => {
      const { finishStep1, button, stable, input, accountsApi, heading } = await setup();
      await finishStep1('Main card');
      button('Back').click();
      await stable();
      expect(visible(heading().textContent)).toBe('Where do you keep your money?');
      expect(input('Name').value).toBe('Main card');
      button('Continue').click();
      await stable();
      expect(accountsApi.create).toHaveBeenCalledTimes(1);
      expect(visible(heading().textContent)).toBe('Set a monthly budget');
    });
  });

  describe('step 3: spending', () => {
    async function onStep3(options: SetupOptions = {}) {
      const result = await setup(options);
      await result.finishStep1('Main card');
      result.button('Skip').click();
      await result.stable();
      return result;
    }

    it('offers the CSV import as coming soon, and the manual option', async () => {
      const { el, button } = await onStep3();
      const options = Array.from(el.querySelectorAll<HTMLButtonElement>('.option'));
      expect(options.map((o) => visible(o.textContent))).toEqual([
        'upload_fileImport a bank statement (CSV)Coming soon',
        'edit_noteAdd a transaction manually',
      ]);
      expect(options[0].getAttribute('aria-disabled')).toBe('true');
      // "Coming soon" is part of its name; no extra description repeats it.
      expect(options[0].hasAttribute('aria-describedby')).toBe(false);
      expect(button("I'll do it later")).toBeTruthy();
    });

    it('completes onboarding, then opens Quick add on Transactions', async () => {
      const { el, stable, auth, navigate } = await onStep3();
      el.querySelectorAll<HTMLButtonElement>('.option')[0].click();
      expect(auth.completeOnboarding).not.toHaveBeenCalled();
      el.querySelectorAll<HTMLButtonElement>('.option')[1].click();
      await stable();
      expect(auth.completeOnboarding).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(['/transactions'], { queryParams: { add: '1' } });
    });

    it('completes onboarding, then goes to the dashboard with "I\'ll do it later"', async () => {
      const { button, stable, auth, navigateByUrl } = await onStep3();
      button("I'll do it later").click();
      await stable();
      expect(auth.completeOnboarding).toHaveBeenCalledTimes(1);
      expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
    });

    it('ignores a second choice while completing', async () => {
      const completing = new Subject<void>();
      const { button, el, stable, auth } = await onStep3({ complete: () => completing });
      button("I'll do it later").click();
      await stable();
      expect(visible(el.querySelector('app-spending-step [role="status"]')?.textContent)).toBe(
        'Saving…',
      );
      // Visible on the chosen option too.
      expect(visible(el.querySelector('.later')?.textContent)).toBe('Saving…');
      expect(visible(el.querySelectorAll('.option')[1].textContent)).not.toContain('Saving…');
      el.querySelectorAll<HTMLButtonElement>('.option')[1].click();
      expect(auth.completeOnboarding).toHaveBeenCalledTimes(1);
      // Back waits too.
      const back = button('Back');
      expect(back.getAttribute('aria-disabled')).toBe('true');
      back.click();
      await stable();
      expect(visible(el.querySelector('h1')?.textContent)).toBe('Add your spending');
    });

    it('returns to step 1 with the message when there is no account (409)', async () => {
      const { stable, button, el, heading, accountsApi, navigateByUrl } = await onStep3({
        complete: () =>
          throwError(
            () =>
              new HttpErrorResponse({
                status: 409,
                error: { detail: 'Add at least one account first.' },
              }),
          ),
      });
      button("I'll do it later").click();
      await stable();
      expect(navigateByUrl).not.toHaveBeenCalled();
      expect(visible(heading().textContent)).toBe('Where do you keep your money?');
      expect(document.activeElement).toBe(heading());
      expect(visible(el.querySelector('app-accounts-step [role="alert"]')?.textContent)).toBe(
        'Add at least one account first.',
      );
      // The remembered accounts were reloaded (none left), so Continue creates them again.
      expect(accountsApi.list).toHaveBeenCalledTimes(2);
      button('Continue').click();
      await stable();
      expect(accountsApi.create).toHaveBeenCalledTimes(2);
    });

    it('shows a generic error for anything else', async () => {
      const { button, stable, el } = await onStep3({
        complete: () => throwError(() => new HttpErrorResponse({ status: 500 })),
      });
      button("I'll do it later").click();
      await stable();
      expect(visible(el.querySelector('app-spending-step [role="alert"]')?.textContent)).toBe(
        'Something went wrong. Try again.',
      );
    });

    it('goes back to step 2 with its limits kept', async () => {
      const { button, stable, heading } = await onStep3();
      button('Back').click();
      await stable();
      expect(visible(heading().textContent)).toBe('Set a monthly budget');
    });
  });

  it('uses one main landmark for the page', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('main')).toHaveLength(1);
  });

  it('offers "Log out" throughout, which ends the session and shows login', async () => {
    const logout$ = new Subject<void>();
    const { el, stable, auth, navigateByUrl, finishStep1 } = await setup({
      logout: () => logout$,
    });
    const logout = () => el.querySelector<HTMLButtonElement>('.top-bar .logout')!;
    expect(visible(logout().textContent)).toBe('Log out');
    await finishStep1('Main card');
    expect(logout()).toBeTruthy();

    logout().click();
    logout().click();
    await stable();
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(logout().getAttribute('aria-disabled')).toBe('true');
    logout$.next();
    expect(navigateByUrl).toHaveBeenCalledWith('/auth/login');
  });
});
