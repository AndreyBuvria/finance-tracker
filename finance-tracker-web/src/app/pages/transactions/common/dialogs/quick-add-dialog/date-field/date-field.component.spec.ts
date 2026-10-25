import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideAppLocale } from '@common/locale/locale.utils';
import { DateFieldComponent } from './date-field.component';

@Component({
  imports: [DateFieldComponent],
  template: `<app-date-field [control]="control" [today]="today" />`,
})
class Host {
  readonly today = new Date(2026, 9, 19);
  readonly control = new FormControl<Date | null>(new Date(2026, 9, 19));
}

describe('DateFieldComponent', () => {
  async function setup() {
    TestBed.configureTestingModule({ providers: [provideAppLocale()] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const chips = () => Array.from(el.querySelectorAll<HTMLElement>('[role="option"]'));
    const selected = () =>
      chips()
        .filter((chip) => chip.getAttribute('aria-selected') === 'true')
        .map((chip) => chip.textContent?.trim());
    return { fixture, el, host: fixture.componentInstance, chips, selected };
  }

  it('picks today or yesterday with the chips', async () => {
    const { fixture, host, chips, selected } = await setup();
    expect(selected()).toEqual(['Today']);
    chips()[1].click();
    await fixture.whenStable();
    expect(host.control.value).toEqual(new Date(2026, 9, 18));
    expect(selected()).toEqual(['Yesterday']);
  });

  it('keeps the selected chip selected when it is clicked again', async () => {
    const { fixture, host, chips, selected } = await setup();
    chips()[0].click();
    await fixture.whenStable();
    expect(selected()).toEqual(['Today']);
    expect(host.control.value).toEqual(new Date(2026, 9, 19));
  });

  it('allows dates up to tomorrow', async () => {
    const { fixture, el, host } = await setup();
    host.control.setValue(new Date(2026, 9, 20));
    await fixture.whenStable();
    expect(host.control.valid).toBe(true);
    host.control.setValue(new Date(2026, 9, 21));
    host.control.markAsTouched();
    await fixture.whenStable();
    expect(host.control.hasError('matDatepickerMax')).toBe(true);
    expect(el.querySelector('mat-error')?.textContent?.trim()).toBe("Date can't be in the future.");
  });
});
