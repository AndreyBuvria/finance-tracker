import { Directive, ElementRef, inject } from '@angular/core';
import { NgControl } from '@angular/forms';

/**
 * Stops whitespace-only input in a text field: leading whitespace is removed as the user types
 * or pastes, so a value of only spaces can't be entered. Spaces inside and at the end of the
 * text are kept while typing (the form trims the value on submit).
 * Keeps the bound form control in sync and the caret in place. Skips IME composition until it
 * ends.
 *
 * Used by the register page only; move it to `infrastructure/directives/` when a second feature
 * needs it (CLAUDE.md "Promoting shared code").
 */
@Directive({
  selector: '[appPreventWhitespace]',
  host: {
    '(input)': 'onInput($event)',
    '(compositionend)': 'normalize()',
  },
})
export class PreventWhitespaceDirective {
  private readonly element = inject<ElementRef<HTMLInputElement | HTMLTextAreaElement>>(ElementRef);
  private readonly ngControl = inject(NgControl, { optional: true, self: true });

  onInput(event: Event): void {
    if (event instanceof InputEvent && event.isComposing) {
      return;
    }
    this.normalize();
  }

  normalize(): void {
    const element = this.element.nativeElement;
    const value = element.value;
    const normalized = value.trimStart();
    if (normalized === value) {
      return;
    }
    const caret = element.selectionStart;
    element.value = normalized;
    this.ngControl?.control?.setValue(normalized, { emitModelToViewChange: false });
    if (caret !== null) {
      const position = Math.max(0, caret - (value.length - normalized.length));
      element.setSelectionRange(position, position);
    }
  }
}
