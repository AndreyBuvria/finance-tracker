import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ClockService } from '@common/time/clock.service';
import { MonthSelectComponent } from '@common/date/month-select/month-select.component';
import { startOfMonth } from '@common/date/month.utils';

/**
 * Dashboard placeholder (DESIGN.md "APP SHELL"): month selector and an empty-state card.
 * The full dashboard is Phase 2.
 */
@Component({
  selector: 'app-dashboard',
  imports: [MatIconModule, MonthSelectComponent],
  template: `
    <h1 i18n="@@dashboard.page.title">Dashboard</h1>
    <app-month-select [(month)]="month" />
    <section class="empty-card">
      <mat-icon class="empty-icon" aria-hidden="true">insights</mat-icon>
      <p i18n="@@dashboard.empty.message">Add your first transaction to see your month.</p>
    </section>
  `,
  styles: `
    h1 {
      margin: 0 0 8px;
      font: var(--mat-sys-headline-small);
    }

    .empty-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      max-width: 560px;
      margin-top: 16px;
      padding: 32px 24px;
      border-radius: var(--mat-sys-corner-large);
      background: var(--mat-sys-surface-container-low);
      text-align: center;

      p {
        margin: 0;
        font: var(--mat-sys-body-large);
      }
    }

    .empty-icon {
      width: 48px;
      height: 48px;
      font-size: 48px;
      color: var(--mat-sys-primary);
    }
  `,
})
export class DashboardComponent {
  private readonly clock = inject(ClockService);

  /** First day of the selected month; defaults to the current month. */
  readonly month = signal(startOfMonth(this.clock.today()));
}
