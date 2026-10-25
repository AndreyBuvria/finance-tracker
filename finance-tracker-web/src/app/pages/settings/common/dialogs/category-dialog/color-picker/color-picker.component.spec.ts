import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { ColorPickerComponent } from './color-picker.component';

@Component({
  imports: [ColorPickerComponent],
  template: `<app-color-picker [control]="control" />`,
})
class Host {
  readonly control = new FormControl('#2e7d32', { nonNullable: true });
}

describe('ColorPickerComponent', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, host: fixture.componentInstance };
  }

  it('offers the 12 palette colors as named radio buttons', async () => {
    const { el } = await setup();
    expect(el.querySelector('legend')?.textContent?.trim()).toBe('Color');
    const names = Array.from(el.querySelectorAll('input[type="radio"]')).map((r) =>
      r.getAttribute('aria-label'),
    );
    expect(names).toEqual([
      'Red',
      'Pink',
      'Purple',
      'Indigo',
      'Blue',
      'Cyan',
      'Green',
      'Lime',
      'Yellow',
      'Orange',
      'Brown',
      'Blue grey',
    ]);
    // One native radio group, so arrow keys move between the swatches.
    const groups = new Set(Array.from(el.querySelectorAll('input')).map((r) => r.name));
    expect(groups.size).toBe(1);
    expect([...groups][0]).not.toBe('');
  });

  it('paints each swatch and marks the chosen one with a check, not only by color', async () => {
    const { el, host, fixture } = await setup();
    const green = el.querySelector<HTMLInputElement>('[aria-label="Green"]')!;
    expect(green.checked).toBe(true);
    expect(green.parentElement!.style.backgroundColor).toBe('rgb(46, 125, 50)');
    expect(green.nextElementSibling?.textContent?.trim()).toBe('check');

    el.querySelector<HTMLInputElement>('[aria-label="Yellow"]')!.click();
    await fixture.whenStable();
    expect(host.control.value).toBe('#fbc02d');
  });
});
