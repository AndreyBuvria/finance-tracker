import { Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, ValidationErrors } from '@angular/forms';
import { map, startWith, switchMap } from 'rxjs';

/** A form control's value and error state, as a signal for templates. */
export interface ControlState<T> {
  readonly value: T;
  /** Invalid and touched: show the error. */
  readonly showError: boolean;
  readonly errors: ValidationErrors | null;
}

/**
 * Follows a control passed as an `input()` (value, errors, touched), for child components that
 * render a control themselves: errors set from outside (e.g. API messages) then still re-render
 * the child. Call in an injection context.
 */
export function controlState<T>(
  control: Signal<AbstractControl<T>>,
  initial: T,
): Signal<ControlState<T>> {
  return toSignal(
    toObservable(control).pipe(
      switchMap((c) =>
        c.events.pipe(
          startWith(null),
          map(() => ({ value: c.value, showError: c.invalid && c.touched, errors: c.errors })),
        ),
      ),
    ),
    { initialValue: { value: initial, showError: false, errors: null } },
  );
}
