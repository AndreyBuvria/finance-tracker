import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { PreventWhitespaceDirective } from './prevent-whitespace.directive';

@Component({
  imports: [PreventWhitespaceDirective, ReactiveFormsModule],
  template: `
    <input class="bound" appPreventWhitespace [formControl]="name" />
    <input class="plain" appPreventWhitespace />
  `,
})
class Host {
  readonly name = new FormControl('', { nonNullable: true });
}

describe('PreventWhitespaceDirective', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const bound = el.querySelector<HTMLInputElement>('.bound')!;
    const plain = el.querySelector<HTMLInputElement>('.plain')!;
    const type = (input: HTMLInputElement, value: string, init: InputEventInit = {}) => {
      input.value = value;
      input.dispatchEvent(new InputEvent('input', init));
    };
    return { host: fixture.componentInstance, bound, plain, type };
  }

  it('does not let a value of only spaces in', async () => {
    const { host, bound, type } = await setup();
    type(bound, ' ');
    expect(bound.value).toBe('');
    expect(host.name.value).toBe('');
    type(bound, '  \t ');
    expect(bound.value).toBe('');
    expect(host.name.value).toBe('');
  });

  it('removes leading whitespace, also from pasted text', async () => {
    const { host, bound, type } = await setup();
    type(bound, '   Kasia', { inputType: 'insertFromPaste' });
    expect(bound.value).toBe('Kasia');
    expect(host.name.value).toBe('Kasia');
  });

  it('keeps spaces inside and at the end of the text', async () => {
    const { host, bound, type } = await setup();
    type(bound, 'Anna Maria ');
    expect(bound.value).toBe('Anna Maria ');
    expect(host.name.value).toBe('Anna Maria ');
  });

  it('keeps the caret where the user was typing', async () => {
    const { bound } = await setup();
    bound.focus();
    bound.value = '  Kasia';
    bound.setSelectionRange(4, 4);
    bound.dispatchEvent(new InputEvent('input'));
    expect(bound.value).toBe('Kasia');
    expect(bound.selectionStart).toBe(2);
  });

  it('waits for IME composition to end', async () => {
    const { bound, type } = await setup();
    type(bound, ' ', { isComposing: true });
    expect(bound.value).toBe(' ');
    bound.dispatchEvent(new CompositionEvent('compositionend'));
    expect(bound.value).toBe('');
  });

  it('works on an input without a form control', async () => {
    const { plain, type } = await setup();
    type(plain, '  x');
    expect(plain.value).toBe('x');
  });
});
