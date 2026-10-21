import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NavigationVariant, NavItem } from '../navigation.model';

/**
 * Main navigation: a rail on desktop (a drawer with inline labels from 1200 px) or a bottom bar
 * on mobile. The active destination gets `aria-current="page"`.
 */
@Component({
  selector: 'app-navigation',
  imports: [MatIconModule, RouterLink, RouterLinkActive],
  template: `
    <nav
      [class]="variant() === 'rail' ? 'rail' : 'bottom-nav'"
      aria-label="Main"
      i18n-aria-label="@@shell.nav.label"
    >
      <ul class="nav-list">
        @for (item of items(); track item.path) {
          <li>
            <a
              class="nav-link"
              [routerLink]="item.path"
              routerLinkActive="active"
              ariaCurrentWhenActive="page"
            >
              <span class="nav-indicator"
                ><mat-icon aria-hidden="true">{{ item.icon }}</mat-icon></span
              >
              <span class="nav-label">{{ item.label }}</span>
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
  styleUrl: './navigation.component.scss',
})
export class NavigationComponent {
  readonly items = input.required<readonly NavItem[]>();
  readonly variant = input.required<NavigationVariant>();
}
