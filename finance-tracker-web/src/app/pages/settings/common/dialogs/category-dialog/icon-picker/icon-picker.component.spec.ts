import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { IconPickerComponent } from './icon-picker.component';

@Component({
  imports: [IconPickerComponent],
  template: `<app-icon-picker [control]="control" describedBy="icon-error" />
    <app-icon-picker [control]="other" />`,
})
class Host {
  readonly control = new FormControl('pets', { nonNullable: true });
  readonly other = new FormControl('', { nonNullable: true });
}

describe('IconPickerComponent', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const picker = el.querySelector('app-icon-picker')!;
    return { fixture, el, picker, host: fixture.componentInstance };
  }

  it('offers the 40 icons as named radio buttons in a labelled group', async () => {
    const { picker } = await setup();
    expect(picker.querySelector('legend')?.textContent?.trim()).toBe('Icon');
    const radios = Array.from(picker.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    expect(radios).toHaveLength(40);
    expect(radios[0].getAttribute('aria-label')).toBe('Shopping cart');
    expect(radios.every((r) => !!r.getAttribute('aria-label'))).toBe(true);
    expect(picker.querySelector('fieldset')?.getAttribute('aria-describedby')).toBe('icon-error');
  });

  it('shows and changes the chosen icon', async () => {
    const { picker, host } = await setup();
    expect(picker.querySelector<HTMLInputElement>('[aria-label="Pets"]')!.checked).toBe(true);
    picker.querySelector<HTMLInputElement>('[aria-label="Coffee"]')!.click();
    expect(host.control.value).toBe('local_cafe');
  });

  it('keeps each picker its own radio group', async () => {
    const { el } = await setup();
    const [first, second] = Array.from(el.querySelectorAll('app-icon-picker'));
    expect(first.querySelector('input')!.name).not.toBe(second.querySelector('input')!.name);
  });
});
