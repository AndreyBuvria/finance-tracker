import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { HeaderAction } from './header-action.model';

interface Registration {
  readonly actions: readonly HeaderAction[];
}

/**
 * The current page's header actions (CLAUDE.md "Header actions"). Pages register them, the layout
 * renders them and calls their handlers, so the layout never knows what an action does.
 *
 * The newest registration wins. Each registration removes only itself, so a page that is destroyed
 * after the next page registered (route change order) can't clear the new page's actions.
 */
@Injectable({ providedIn: 'root' })
export class HeaderActionsService {
  private readonly registrations = signal<readonly Registration[]>([]);

  /** Actions of the current page; empty when the page registered none. */
  readonly actions = computed(() => this.registrations().at(-1)?.actions ?? []);

  /** The page's main action, if any. */
  readonly primary = computed(() => this.actions().find((action) => action.primary) ?? null);

  /** Shows `actions` until the returned function is called. Prefer `registerHeaderActions()`. */
  register(actions: readonly HeaderAction[]): () => void {
    if (actions.filter((action) => action.primary).length > 1) {
      throw new Error('A page can have at most one primary header action.');
    }
    const registration: Registration = { actions };
    this.registrations.update((list) => [...list, registration]);
    return () => this.registrations.update((list) => list.filter((r) => r !== registration));
  }
}

/**
 * Registers the calling page's header actions and removes them when the page is destroyed.
 * Call it in an injection context (a field initializer or the constructor).
 */
export function registerHeaderActions(actions: readonly HeaderAction[]): void {
  const unregister = inject(HeaderActionsService).register(actions);
  inject(DestroyRef).onDestroy(unregister);
}
