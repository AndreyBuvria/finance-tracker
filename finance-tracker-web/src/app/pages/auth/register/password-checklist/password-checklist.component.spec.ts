import { TestBed } from '@angular/core/testing';
import { PasswordChecklistComponent } from './password-checklist.component';

describe('PasswordChecklistComponent', () => {
  async function render(password: string) {
    const fixture = TestBed.createComponent(PasswordChecklistComponent);
    fixture.componentRef.setInput('password', password);
    await fixture.whenStable();
    const items = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('li'));
    return { fixture, items };
  }

  it('lists the three requirements with the FEATURES.md wording', async () => {
    const { items } = await render('');
    expect(items.map((li) => li.querySelector('span')?.textContent)).toEqual([
      'At least 8 characters',
      'At least one letter',
      'At least one number',
    ]);
    expect(items.every((li) => !li.classList.contains('met'))).toBe(true);
  });

  it('ticks requirements off with an icon and screen-reader text, not just color', async () => {
    const { fixture, items } = await render('kasia');
    expect(items.map((li) => li.classList.contains('met'))).toEqual([false, true, false]);
    expect(items[1].querySelector('mat-icon')?.textContent).toBe('check_circle');
    expect(items[1].querySelector('.visually-hidden')?.textContent?.trim()).toBe('(done)');
    expect(items[0].querySelector('.visually-hidden')?.textContent?.trim()).toBe('(not done yet)');

    fixture.componentRef.setInput('password', 'kasia2026');
    await fixture.whenStable();
    expect(items.map((li) => li.classList.contains('met'))).toEqual([true, true, true]);
  });

  it('does not tick "At least one number" for a non-ASCII digit', async () => {
    const { items } = await render('kasiakasia\u0663');
    expect(items.map((li) => li.classList.contains('met'))).toEqual([true, true, false]);
  });
});
