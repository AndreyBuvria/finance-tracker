import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAppLocale } from '../locale/locale.utils';
import { MoneyKind } from '../formatting/money.model';
import { MoneyPipe } from './money.pipe';

@Component({
  imports: [MoneyPipe],
  template: `<span>{{ amount() | money: kind() }}</span>`,
})
class Host {
  readonly amount = signal<number | null>(1234.56);
  readonly kind = signal<MoneyKind>('plain');
}

describe('MoneyPipe', () => {
  const pipe = new MoneyPipe();

  it('formats amounts and passes the kind through', () => {
    expect(pipe.transform(1234.56)).toBe('1\u00a0234,56\u00a0zł');
    expect(pipe.transform(24, 'expense')).toBe('\u221224,00\u00a0zł');
    expect(pipe.transform(7500, 'income')).toBe('+7\u00a0500,00\u00a0zł');
  });

  it('returns an empty string for null and undefined', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });

  it('formats in Polish even though the UI locale is English', async () => {
    TestBed.configureTestingModule({ providers: [provideAppLocale()] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const span = (fixture.nativeElement as HTMLElement).querySelector('span');
    expect(span?.textContent).toBe('1\u00a0234,56\u00a0zł');

    fixture.componentInstance.amount.set(56.9);
    fixture.componentInstance.kind.set('expense');
    await fixture.whenStable();
    expect(span?.textContent).toBe('\u221256,90\u00a0zł');
  });
});
