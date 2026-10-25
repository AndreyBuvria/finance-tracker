import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ShortcutsPreferenceService } from '@common/preferences/shortcuts-preference.service';

/**
 * Turns single-key shortcuts (e.g. `N` for "Add") on or off (PLAN.md §8 Settings, WCAG 2.1.4).
 * Saved right away, per user on this device.
 */
@Component({
  selector: 'app-shortcuts-setting',
  imports: [MatSlideToggleModule, ReactiveFormsModule],
  template: `
    <section class="setting" aria-labelledby="shortcuts-heading">
      <h2 id="shortcuts-heading" i18n="@@settings.shortcuts.heading">Keyboard shortcuts</h2>
      <mat-slide-toggle [formControl]="enabled" aria-describedby="shortcuts-hint">
        <span i18n="@@settings.shortcuts.toggle">Single-key shortcuts</span>
      </mat-slide-toggle>
      <p id="shortcuts-hint" class="hint">
        <ng-container i18n="@@settings.shortcuts.hint"
          >Press N to add a transaction or an account. Turn this off if keys trigger actions by
          accident, for example with speech input.</ng-container
        >
      </p>
    </section>
  `,
  styles: `
    .setting {
      display: grid;
      justify-items: start;
      gap: 8px;
      max-width: 560px;
      padding: 16px;
      border-radius: var(--mat-sys-corner-large);
      background: var(--mat-sys-surface-container-low);
    }

    h2 {
      margin: 0;
      font: var(--mat-sys-title-medium);
    }

    .hint {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-medium);
    }
  `,
})
export class ShortcutsSettingComponent {
  private readonly preference = inject(ShortcutsPreferenceService);

  readonly enabled = inject(NonNullableFormBuilder).control(this.preference.enabled());

  constructor() {
    this.enabled.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((enabled) => this.preference.setEnabled(enabled));
  }
}
