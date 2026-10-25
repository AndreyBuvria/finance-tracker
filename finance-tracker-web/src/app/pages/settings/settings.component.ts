import { Component } from '@angular/core';
import { CategoriesSettingsComponent } from './categories/categories-settings.component';
import { ShortcutsSettingComponent } from './shortcuts-setting/shortcuts-setting.component';

/** Settings (PLAN.md §8): keyboard shortcuts and categories; rules come later (PLAN.md §9). */
@Component({
  selector: 'app-settings',
  imports: [CategoriesSettingsComponent, ShortcutsSettingComponent],
  template: `
    <h1 i18n="@@settings.page.title">Settings</h1>
    <app-shortcuts-setting />
    <app-categories-settings />
  `,
  styles: `
    h1 {
      margin: 0 0 16px;
      font: var(--mat-sys-headline-small);
    }
  `,
})
export class SettingsComponent {}
