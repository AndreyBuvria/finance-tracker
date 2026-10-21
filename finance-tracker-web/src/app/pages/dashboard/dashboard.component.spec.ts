import { TestBed } from '@angular/core/testing';
import { provideAppLocale } from '@common/locale/locale.utils';
import { provideFakeClock } from '@common/time/testing/fake-clock.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  async function setup(now: string) {
    TestBed.configureTestingModule({ providers: [provideAppLocale(), provideFakeClock(now)] });
    const fixture = TestBed.createComponent(DashboardComponent);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('defaults the month selector to the current month from the clock', async () => {
    const { el, fixture } = await setup('2026-10-21T10:00:00');
    expect(el.querySelector('.month')?.textContent).toBe('October 2026');
    expect(fixture.componentInstance.month()).toEqual(new Date(2026, 9, 1));
  });

  it('uses the clock, not the system date', async () => {
    const { el } = await setup('2027-03-31T23:59:00');
    expect(el.querySelector('.month')?.textContent).toBe('March 2027');
  });

  it('shows the empty-state card', async () => {
    const { el } = await setup('2026-10-21T10:00:00');
    expect(el.querySelector('h1')?.textContent).toBe('Dashboard');
    expect(el.querySelector('.empty-card')?.textContent).toContain(
      'Add your first transaction to see your month.',
    );
  });
});
