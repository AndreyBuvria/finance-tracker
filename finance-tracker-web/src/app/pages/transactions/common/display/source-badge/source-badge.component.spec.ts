import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAppLocale } from '@common/locale/locale.utils';
import { TransactionImportInfo } from '@common/transactions/transaction.model';
import { TransactionSourceEnum } from '@common/transactions/transaction-source.enum';
import { SourceBadgeComponent } from './source-badge.component';

@Component({
  imports: [SourceBadgeComponent],
  template: `<app-source-badge [source]="source()" [importInfo]="info()" />`,
})
class Host {
  readonly source = signal(TransactionSourceEnum.Manual);
  readonly info = signal<TransactionImportInfo | null>(null);
}

describe('SourceBadgeComponent', () => {
  async function setup(source: TransactionSourceEnum, info: TransactionImportInfo | null = null) {
    TestBed.configureTestingModule({ providers: [provideAppLocale()] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.source.set(source);
    fixture.componentInstance.info.set(info);
    await fixture.whenStable();
    const badge = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.badge')!;
    const component = fixture.debugElement.children[0].componentInstance as SourceBadgeComponent;
    return { badge, component };
  }

  it('labels manual and bank-sync rows', async () => {
    expect((await setup(TransactionSourceEnum.Manual)).badge.textContent).toBe('Manual');
    TestBed.resetTestingModule();
    expect((await setup(TransactionSourceEnum.OpenBanking)).badge.textContent).toBe('Bank sync');
  });

  it('gives imported rows a focusable tooltip with the import date', async () => {
    const { badge, component } = await setup(TransactionSourceEnum.Csv, {
      batchId: 'b1',
      importedAt: '2026-10-18T09:00:00Z',
    });
    expect(badge.textContent).toBe('Imported');
    expect(badge.getAttribute('tabindex')).toBe('0');
    expect(badge.getAttribute('role')).toBe('img');
    expect(badge.getAttribute('aria-label')).toBe('Imported');
    expect(component.tooltip()).toBe('Imported on 18 Oct 2026');
  });

  it('has no tooltip without import details', async () => {
    const { badge, component } = await setup(TransactionSourceEnum.Csv);
    expect(badge.textContent).toBe('Imported');
    expect(badge.hasAttribute('tabindex')).toBe(false);
    expect(badge.hasAttribute('role')).toBe(false);
    expect(component.tooltip()).toBe('');
  });
});
