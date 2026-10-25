import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { controlState } from './control-state.utils';

@Component({ template: '' })
class Host {
  readonly control = signal(
    new FormControl('', { nonNullable: true, validators: Validators.required }),
  );
  readonly state = controlState(this.control, 'initial');
}

describe('controlState', () => {
  it('follows value, errors and touched, also for errors set from outside', () => {
    const host = TestBed.createComponent(Host).componentInstance;
    const control = host.control();
    expect(host.state().value).toBe('initial');
    TestBed.tick();
    expect(host.state()).toEqual({ value: '', showError: false, errors: { required: true } });

    control.markAsTouched();
    expect(host.state().showError).toBe(true);

    control.setValue('Bolt');
    expect(host.state()).toEqual({ value: 'Bolt', showError: false, errors: null });

    control.setErrors({ server: 'Merchant can be at most 200 characters.' });
    expect(host.state().errors).toEqual({ server: 'Merchant can be at most 200 characters.' });
  });

  it('switches to a new control', () => {
    const host = TestBed.createComponent(Host).componentInstance;
    host.control.set(new FormControl('other', { nonNullable: true }));
    TestBed.tick();
    expect(host.state().value).toBe('other');
  });
});
