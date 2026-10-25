import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { MerchantSuggestion } from '@common/transactions/transaction.model';
import { TransactionsApiService } from '@common/transactions/transactions-api.service';
import { of, throwError } from 'rxjs';
import { MerchantFieldComponent } from './merchant-field.component';

@Component({
  imports: [MerchantFieldComponent],
  template: `<app-merchant-field [control]="control" (suggestionChosen)="chosen.push($event)" />`,
})
class Host {
  readonly control = new FormControl('', { nonNullable: true });
  readonly chosen: MerchantSuggestion[] = [];
}

const ZABKA: MerchantSuggestion = {
  merchant: 'Żabka',
  lastUsedOn: '2026-10-18',
  lastCategory: null,
};

describe('MerchantFieldComponent', () => {
  async function setup(merchants = vi.fn(() => of({ items: [ZABKA] }))) {
    TestBed.configureTestingModule({
      providers: [{ provide: TransactionsApiService, useValue: { merchants } }],
    });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const component = fixture.debugElement.children[0].componentInstance as MerchantFieldComponent;
    return { fixture, host: fixture.componentInstance, component, merchants };
  }

  /** Renders without waiting for stability (fake timers would keep it pending). */
  function setupWithFakeTimers() {
    const merchants = vi.fn(() => of({ items: [ZABKA] }));
    TestBed.configureTestingModule({
      providers: [{ provide: TransactionsApiService, useValue: { merchants } }],
    });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const component = fixture.debugElement.children[0].componentInstance as MerchantFieldComponent;
    return { fixture, host: fixture.componentInstance, component, merchants };
  }

  afterEach(() => vi.useRealTimers());

  it('suggests past merchants after a pause in typing', async () => {
    vi.useFakeTimers();
    const { fixture, host, component, merchants } = await setupWithFakeTimers();
    host.control.setValue(' za');
    vi.advanceTimersByTime(249);
    expect(merchants).not.toHaveBeenCalledWith('za');
    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(merchants).toHaveBeenLastCalledWith('za');
    expect(component.options()).toEqual([ZABKA]);
  });

  it('fills the field and reports a chosen merchant', async () => {
    const { component, host } = await setup();
    component.choose(ZABKA);
    expect(host.control.value).toBe('Żabka');
    expect(host.chosen).toEqual([ZABKA]);
    expect(component.display(ZABKA)).toBe('Żabka');
    expect(component.display('typed')).toBe('typed');
  });

  it('shows no suggestions when they cannot be loaded', async () => {
    const { component } = await setup(vi.fn(() => throwError(() => new Error('offline'))));
    expect(component.options()).toEqual([]);
  });

  it('shows an API message set on the control', async () => {
    const { fixture, host } = await setup();
    host.control.setErrors({ server: 'Merchant can be at most 200 characters.' });
    host.control.markAsTouched();
    await fixture.whenStable();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('mat-error')?.textContent?.trim(),
    ).toBe('Merchant can be at most 200 characters.');
  });
});
