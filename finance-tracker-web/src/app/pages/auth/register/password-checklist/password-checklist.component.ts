import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { checkPassword } from '../../utils/password.utils';
import { PasswordRule } from '../../common/password.model';

/**
 * Live password requirements (FEATURES.md F1), ticked off while typing.
 * Each item shows an icon and, for screen readers, a "done"/"not done" text, so the state never
 * depends on color.
 */
@Component({
  selector: 'app-password-checklist',
  imports: [MatIconModule],
  template: `
    <ul class="checklist">
      @for (item of items(); track item.rule) {
        <li [class.met]="item.met">
          <mat-icon aria-hidden="true">{{
            item.met ? 'check_circle' : 'radio_button_unchecked'
          }}</mat-icon>
          <span>{{ item.label }}</span>
          <span class="visually-hidden">
            @if (item.met) {
              <ng-container i18n="@@register.password.rule.met">(done)</ng-container>
            } @else {
              <ng-container i18n="@@register.password.rule.unmet">(not done yet)</ng-container>
            }
          </span>
        </li>
      }
    </ul>
  `,
  styles: `
    .checklist {
      display: grid;
      gap: 4px;
      margin: 0;
      padding: 0;
      list-style: none;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    li {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
    }

    .met {
      color: var(--mat-sys-on-surface);

      mat-icon {
        color: var(--app-color-ok);
      }
    }
  `,
})
export class PasswordChecklistComponent {
  readonly password = input('');

  private readonly labels: Readonly<Record<PasswordRule, string>> = {
    minLength: $localize`:@@register.password.rule.minLength:At least 8 characters`,
    letter: $localize`:@@register.password.rule.letter:At least one letter`,
    number: $localize`:@@register.password.rule.number:At least one number`,
  };

  readonly items = computed(() => {
    const checks = checkPassword(this.password());
    return (['minLength', 'letter', 'number'] as const).map((rule) => ({
      rule,
      met: checks[rule],
      label: this.labels[rule],
    }));
  });
}
