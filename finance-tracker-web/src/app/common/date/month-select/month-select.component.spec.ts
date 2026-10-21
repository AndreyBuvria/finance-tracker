import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAppLocale } from '@common/locale/locale.utils';
import { MonthSelectComponent } from './month-select.component';

@Component({
  imports: [MonthSelectComponent],
  template: `<app-month-select [(month)]="month" />`,
})
class Host {
  readonly month = signal(new Date(2026, 9, 1));
}

describe('MonthSelectComponent', () => {
  async function setup() {
    TestBed.configureTestingModule({ providers: [provideAppLocale()] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const button = (label: string) =>
      el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
    return { fixture, el, host: fixture.componentInstance, button };
  }

  it('shows the month as "October 2026"', async () => {
    const { el } = await setup();
    expect(el.querySelector('.month')?.textContent).toBe('October 2026');
  });

  it('moves to the next and previous month and updates the bound value', async () => {
    const { el, fixture, host, button } = await setup();
    button('Next month').click();
    await fixture.whenStable();
    expect(host.month()).toEqual(new Date(2026, 10, 1));
    expect(el.querySelector('.month')?.textContent).toBe('November 2026');

    button('Previous month').click();
    button('Previous month').click();
    await fixture.whenStable();
    expect(el.querySelector('.month')?.textContent).toBe('September 2026');
  });

  it('crosses the year boundary', async () => {
    const { el, fixture, host, button } = await setup();
    host.month.set(new Date(2026, 11, 1));
    await fixture.whenStable();
    button('Next month').click();
    await fixture.whenStable();
    expect(el.querySelector('.month')?.textContent).toBe('January 2027');
  });
});
