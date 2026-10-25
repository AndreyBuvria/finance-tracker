import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Category } from '@common/categories/category.model';
import { category } from '../../testing/category-fixtures.utils';
import { CategoryRowComponent } from './category-row.component';

@Component({
  imports: [CategoryRowComponent],
  template: `<app-category-row
    [category]="category()"
    [busy]="busy()"
    (renameRequested)="events.push('rename')"
    (restoreRequested)="events.push('restore')"
    (deleteRequested)="events.push('delete')"
  />`,
})
class Host {
  readonly category = signal<Category>(category({ id: 'c1', name: 'Coffee' }));
  readonly busy = signal(false);
  readonly events: string[] = [];
}

const visible = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

describe('CategoryRowComponent', () => {
  async function setup(value: Category) {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.category.set(value);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, host: fixture.componentInstance };
  }

  it('shows the transaction count with plural forms', async () => {
    const { el, fixture, host } = await setup(category({ transactionCount: 1 }));
    expect(visible(el.querySelector('.count')?.textContent)).toBe('1 transaction');
    host.category.set(category({ transactionCount: 34 }));
    await fixture.whenStable();
    expect(visible(el.querySelector('.count')?.textContent)).toBe('34 transactions');
    host.category.set(category({ transactionCount: 0 }));
    await fixture.whenStable();
    expect(visible(el.querySelector('.count')?.textContent)).toBe('0 transactions');
  });

  it('gives an active row a named menu button, with the actions ID', async () => {
    const { el } = await setup(category({ id: 'c1', name: 'Coffee' }));
    const menu = el.querySelector<HTMLButtonElement>('.menu-button')!;
    expect(menu.id).toBe('category-actions-c1');
    expect(menu.getAttribute('aria-label')).toBe('More actions for Coffee');
    expect(el.querySelector('.badge')).toBeNull();
  });

  it('shows a hidden default with its badge, Rename and Restore, but no Delete', async () => {
    const { el } = await setup(
      category({ id: 'h', name: 'Health', systemKey: 'health', isArchived: true }),
    );
    expect(visible(el.querySelector('.badge')?.textContent)).toBe('Hidden');
    expect(
      Array.from(el.querySelectorAll('button')).map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Rename Health', 'Restore Health']);
    expect(el.querySelector('.restore')?.id).toBe('category-actions-h');
  });

  it('offers Delete for an archived custom category without transactions', async () => {
    const { el, host } = await setup(category({ name: 'Beans', isArchived: true }));
    expect(visible(el.querySelector('.badge')?.textContent)).toBe('Archived');
    el.querySelector<HTMLButtonElement>('.delete')!.click();
    el.querySelector<HTMLButtonElement>('.restore')!.click();
    expect(host.events).toEqual(['delete', 'restore']);
  });

  it('keeps an archived custom category with transactions', async () => {
    const { el } = await setup(category({ isArchived: true, transactionCount: 3 }));
    expect(el.querySelector('.delete')).toBeNull();
  });

  it('disables its actions while busy', async () => {
    const { el, fixture, host } = await setup(category({ isArchived: true }));
    host.busy.set(true);
    await fixture.whenStable();
    expect(Array.from(el.querySelectorAll('button')).every((b) => b.disabled)).toBe(true);
  });
});
