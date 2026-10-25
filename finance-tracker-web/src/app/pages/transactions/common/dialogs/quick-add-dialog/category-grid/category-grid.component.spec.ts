import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { CATEGORIES, IDS } from '../../../../testing/transaction-fixtures.utils';
import { CategoryGroup } from '../../../models/category-group.model';
import { CategoryGridComponent } from './category-grid.component';

@Component({
  imports: [CategoryGridComponent],
  template: `<app-category-grid [control]="control" [top]="top" [groups]="groups" />
    <app-category-grid [control]="other" [top]="top" [groups]="groups" />`,
})
class Host {
  readonly control = new FormControl('', { nonNullable: true, validators: Validators.required });
  readonly other = new FormControl('', { nonNullable: true });
  readonly top = CATEGORIES.slice(0, 2);
  readonly groups: CategoryGroup[] = [{ label: 'Expense', categories: CATEGORIES.slice(0, 3) }];
}

const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('CategoryGridComponent', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const grid = el.querySelector('app-category-grid')!;
    const topTiles = () =>
      Array.from(grid.querySelector('.tiles')!.children).map((tile) => text(tile));
    return { fixture, el, grid, host: fixture.componentInstance, topTiles };
  }

  it('shows the top tiles and "More", which reveals every category', async () => {
    const { grid, fixture, topTiles } = await setup();
    expect(topTiles()).toEqual([
      'shopping_cartGroceries',
      'directions_busTransport',
      'more_horizMore',
    ]);
    const more = grid.querySelector<HTMLButtonElement>('.more')!;
    const all = grid.querySelector<HTMLElement>('.all')!;
    expect(all.hidden).toBe(true);
    expect(more.getAttribute('aria-controls')).toBe(all.id);
    more.click();
    await fixture.whenStable();
    expect(all.hidden).toBe(false);
    expect(all.querySelectorAll('.tile')).toHaveLength(3);
  });

  it('gives a selected category outside the top tiles its own tile', async () => {
    const { grid, fixture, host, topTiles } = await setup();
    grid.querySelector<HTMLButtonElement>('.more')!.click();
    await fixture.whenStable();
    Array.from(grid.querySelectorAll<HTMLButtonElement>('.all .tile'))
      .find((tile) => text(tile).endsWith('Eating out'))!
      .click();
    await fixture.whenStable();
    expect(host.control.value).toBe(IDS.eatingOut);
    expect(topTiles()).toEqual([
      'shopping_cartGroceries',
      'directions_busTransport',
      'restaurantEating out',
      'more_horizMore',
    ]);
    expect(grid.querySelector('.tiles .selected')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('announces the error and links it to the tiles', async () => {
    const { grid, fixture, host } = await setup();
    host.control.markAsTouched();
    await fixture.whenStable();
    const error = grid.querySelector('.error')!;
    expect(error.getAttribute('role')).toBe('alert');
    expect(text(error)).toBe('Choose a category.');
    expect(grid.querySelector('.tile')?.getAttribute('aria-describedby')).toBe(error.id);
  });

  it('shows an API message put on the control instead of the generic one', async () => {
    const { grid, fixture, host } = await setup();
    host.control.setErrors({ server: 'This category is hidden. Choose an active category.' });
    host.control.markAsTouched();
    await fixture.whenStable();
    expect(text(grid.querySelector('.error')!)).toBe(
      'This category is hidden. Choose an active category.',
    );

    host.control.setValue(IDS.groceries);
    host.control.setValue('');
    await fixture.whenStable();
    expect(text(grid.querySelector('.error')!)).toBe('Choose a category.');
  });

  it('uses its own element IDs per grid', async () => {
    const { el } = await setup();
    const [first, second] = Array.from(el.querySelectorAll('app-category-grid .all'));
    expect(first.id).not.toBe(second.id);
  });
});
