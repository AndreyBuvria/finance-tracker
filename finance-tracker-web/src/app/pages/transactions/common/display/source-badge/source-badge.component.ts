import { formatDate } from '@angular/common';
import { Component, computed, inject, input, LOCALE_ID } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DATE_FORMAT } from '@common/formatting/date-formats.constants';
import { TransactionImportInfo } from '@common/transactions/transaction.model';
import { TransactionSourceEnum } from '@common/transactions/transaction-source.enum';

/**
 * Source badge (FEATURES.md F3): "Manual", "Imported" (tooltip with the import date) or "Bank sync".
 * The imported badge is focusable so keyboard users get its tooltip too.
 */
@Component({
  selector: 'app-source-badge',
  imports: [MatTooltipModule],
  template: `
    @switch (source()) {
      @case (sources.Csv) {
        @if (tooltip()) {
          <!-- Focusable so keyboard users get the tooltip; the tooltip text is its description. -->
          <span
            class="badge"
            tabindex="0"
            role="img"
            [attr.aria-label]="importedLabel"
            [matTooltip]="tooltip()"
            >{{ importedLabel }}</span
          >
        } @else {
          <span class="badge">{{ importedLabel }}</span>
        }
      }
      @case (sources.OpenBanking) {
        <span class="badge" i18n="@@transactions.source.bankSync">Bank sync</span>
      }
      @default {
        <span class="badge" i18n="@@transactions.source.manual">Manual</span>
      }
    }
  `,
  styles: `
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: var(--mat-sys-corner-small);
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-small);
      white-space: nowrap;
    }
  `,
})
export class SourceBadgeComponent {
  private readonly locale = inject(LOCALE_ID);

  protected readonly sources = TransactionSourceEnum;
  protected readonly importedLabel = $localize`:@@transactions.source.imported:Imported`;

  readonly source = input.required<TransactionSourceEnum>();
  readonly importInfo = input<TransactionImportInfo | null>(null);

  /**
   * "Imported on 19 Oct 2026". FEATURES.md also asks for the file name, which the API doesn't return
   * yet (the batch's file name arrives with the import pipeline, Phase 4).
   */
  readonly tooltip = computed(() => {
    const info = this.importInfo();
    if (this.source() !== TransactionSourceEnum.Csv || !info) {
      return '';
    }
    const date = formatDate(info.importedAt, DATE_FORMAT, this.locale);
    return $localize`:@@transactions.source.importedOn:Imported on ${date}:date:`;
  });
}
