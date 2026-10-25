import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Category } from '@common/categories/category.model';
import { category } from '../../testing/category-fixtures.utils';
import { HiddenCategoriesComponent } from './hidden-categories.component';

@Component({
  imports: [HiddenCategoriesComponent],
  template: `<app-hidden-categories
    [categories]="categories()"
    (renameRequested)="events.push('rename ' + $event.name)"
    (restoreRequested)="events.push('restore ' + $event.name)"
    (deleteRequested)="events.push('delete ' + $event.name)"
  />`,
})
class Host {
  readonly categories = signal<Category[]>([]);
  readonly events: string[] = [];
}

describe('HiddenCategoriesComponent', () => {
  async function setup(categories: Category[]) {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.categories.set(categories);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, host: fixture.componentInstance };
  }

  it('shows nothing when there are no hidden categories', async () => {
    const { el } = await setup([]);
    expect(el.querySelector('h3')).toBeNull();
  });

  it('is collapsed with a count and opens on demand', async () => {
    const { el, fixture } = await setup([
      category({ id: 'a', name: 'Beans', isArchived: true }),
      category({ id: 'b', name: 'Health', systemKey: 'health', isArchived: true }),
    ]);
    const toggle = el.querySelector<HTMLButtonElement>('#hidden-categories-toggle')!;
    expect(toggle.textContent).toContain('Hidden & archived (2)');
    expect(toggle.getAttribute('aria-controls')).toBe('hidden-categories-list');
    const list = el.querySelector<HTMLElement>('#hidden-categories-list')!;
    expect(list.hidden).toBe(true);
    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(list.hidden).toBe(false);
  });

  it('passes the row actions on', async () => {
    const { el, fixture, host } = await setup([
      category({ id: 'a', name: 'Beans', isArchived: true }),
    ]);
    el.querySelector<HTMLButtonElement>('#hidden-categories-toggle')!.click();
    await fixture.whenStable();
    for (const selector of ['button[aria-label^="Rename"]', '.delete', '.restore']) {
      el.querySelector<HTMLButtonElement>(`#hidden-categories-list ${selector}`)!.click();
    }
    expect(host.events).toEqual(['rename Beans', 'delete Beans', 'restore Beans']);
  });
});
