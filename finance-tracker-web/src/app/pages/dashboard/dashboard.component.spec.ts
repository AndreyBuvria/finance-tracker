import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { HeaderActionsService } from '@infrastructure/layout/header-actions/header-actions.service';
import { provideAppLocale } from '@common/locale/locale.utils';
import { provideFakeClock } from '@common/time/testing/fake-clock.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  async function setup(now: string) {
    TestBed.configureTestingModule({
      providers: [provideAppLocale(), provideFakeClock(now), provideRouter([])],
    });
    const fixture = TestBed.createComponent(DashboardComponent);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('defaults the month selector to the current month from the clock', async () => {
    const { el, fixture } = await setup('2026-10-21T10:00:00Z');
    expect(el.querySelector('.month')?.textContent).toBe('October 2026');
    expect(fixture.componentInstance.month()).toEqual(new Date(2026, 9, 1));
  });

  it('uses the clock, not the system date', async () => {
    const { el } = await setup('2027-03-31T20:00:00Z');
    expect(el.querySelector('.month')?.textContent).toBe('March 2027');
  });

  it('follows the Europe/Warsaw month', async () => {
    // 22:30 UTC on 31 March is already 1 April in Warsaw (CEST, UTC+2).
    const { el } = await setup('2027-03-31T22:30:00Z');
    expect(el.querySelector('.month')?.textContent).toBe('April 2027');
  });

  it('shows the empty-state card', async () => {
    const { el } = await setup('2026-10-21T10:00:00Z');
    expect(el.querySelector('h1')?.textContent).toBe('Dashboard');
    expect(el.querySelector('.empty-card')?.textContent).toContain(
      'Add your first transaction to see your month.',
    );
  });

  it('registers "Add" (N), which opens Quick add on the Transactions page', async () => {
    const { fixture } = await setup('2026-10-21T10:00:00Z');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const actions = TestBed.inject(HeaderActionsService);
    const primary = actions.primary()!;
    expect(primary).toMatchObject({
      label: 'Add',
      accessibleLabel: 'Add transaction',
      shortcut: 'N',
      primary: true,
    });
    primary.handler();
    expect(navigate).toHaveBeenCalledWith(['/transactions'], { queryParams: { add: '1' } });

    fixture.destroy();
    expect(actions.actions()).toEqual([]);
  });
});
