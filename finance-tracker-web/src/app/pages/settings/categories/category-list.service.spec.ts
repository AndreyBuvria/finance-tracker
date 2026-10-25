import { TestBed } from '@angular/core/testing';
import { CategoriesApiService } from '@common/categories/categories-api.service';
import { of } from 'rxjs';
import { CATEGORIES, category } from '../testing/category-fixtures.utils';
import { CategoryListService } from './category-list.service';

describe('CategoryListService', () => {
  async function setup() {
    const api = { list: vi.fn(() => of({ items: [...CATEGORIES] })) };
    TestBed.configureTestingModule({
      providers: [CategoryListService, { provide: CategoriesApiService, useValue: api }],
    });
    const list = TestBed.inject(CategoryListService);
    TestBed.tick();
    await new Promise((done) => setTimeout(done));
    const names = () => list.groups().map((g) => g.categories.map((c) => c.name));
    return { list, api, names };
  }

  it('loads every category, archived ones included', async () => {
    const { api } = await setup();
    expect(api.list).toHaveBeenCalledWith({ includeArchived: true });
  });

  it('groups active categories by type, by name, and lists the hidden ones', async () => {
    const { list, names } = await setup();
    expect(names()).toEqual([
      ['Coffee', 'Dog', 'Eating out', 'Other'],
      ['Other income', 'Salary'],
    ]);
    expect(list.hidden().map((c) => c.name)).toEqual(['Health']);
  });

  it('offers active categories of the same type as merge targets', async () => {
    const { list } = await setup();
    const coffee = CATEGORIES.find((c) => c.id === 'coffee')!;
    expect(list.mergeTargets(coffee).map((c) => c.name)).toEqual(['Dog', 'Eating out', 'Other']);
  });

  it('applies changes locally', async () => {
    const { list, names } = await setup();
    list.put(category({ id: 'kids', name: 'Kids' }));
    list.put(category({ id: 'dog', name: 'Dogs' }));
    list.setArchived('coffee', true);
    list.remove('other');
    expect(names()[0]).toEqual(['Dogs', 'Eating out', 'Kids']);
    expect(list.hidden().map((c) => c.name)).toEqual(['Coffee', 'Health']);

    list.setArchived('coffee', false);
    expect(list.hidden().map((c) => c.name)).toEqual(['Health']);
  });

  it('archives and empties the source after a merge, with the target counts from the API', async () => {
    const { list } = await setup();
    const target = { ...CATEGORIES[0], transactionCount: 74, budgetCount: 1 };
    list.merged('coffee', target);
    const coffee = list.hidden().find((c) => c.id === 'coffee')!;
    expect(coffee).toMatchObject({ isArchived: true, transactionCount: 0, budgetCount: 0 });
    expect(list.groups()[0].categories.find((c) => c.id === 'eating')?.transactionCount).toBe(74);
  });
});
