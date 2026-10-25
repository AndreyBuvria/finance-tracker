import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HeaderAction } from './header-action.model';
import { HeaderActionsService, registerHeaderActions } from './header-actions.service';

function action(overrides: Partial<HeaderAction> = {}): HeaderAction {
  return { id: 'add', label: 'Add', icon: 'add', handler: () => undefined, ...overrides };
}

describe('HeaderActionsService', () => {
  let service: HeaderActionsService;

  beforeEach(() => {
    service = TestBed.inject(HeaderActionsService);
  });

  it('has no actions until a page registers some', () => {
    expect(service.actions()).toEqual([]);
    expect(service.primary()).toBeNull();
  });

  it('exposes the registered actions and the primary one', () => {
    const add = action({ primary: true, shortcut: 'N' });
    const other = action({ id: 'other' });
    service.register([other, add]);
    expect(service.actions()).toEqual([other, add]);
    expect(service.primary()).toBe(add);
  });

  it('removes the actions when unregistered', () => {
    const unregister = service.register([action()]);
    unregister();
    expect(service.actions()).toEqual([]);
  });

  it('shows the newest registration; removing an older one keeps it', () => {
    const unregisterOld = service.register([action({ id: 'old' })]);
    const newer = action({ id: 'new' });
    const unregisterNew = service.register([newer]);
    expect(service.actions()).toEqual([newer]);

    unregisterOld();
    expect(service.actions()).toEqual([newer]);
    unregisterNew();
    expect(service.actions()).toEqual([]);
  });

  it('rejects more than one primary action', () => {
    expect(() =>
      service.register([action({ primary: true }), action({ id: 'b', primary: true })]),
    ).toThrow();
  });
});

describe('registerHeaderActions', () => {
  @Component({ template: '' })
  class Page {
    constructor() {
      registerHeaderActions([action({ primary: true })]);
    }
  }

  it('registers on creation and clears when the page is destroyed', () => {
    const service = TestBed.inject(HeaderActionsService);
    const fixture = TestBed.createComponent(Page);
    expect(service.actions()).toHaveLength(1);
    fixture.destroy();
    expect(service.actions()).toEqual([]);
  });
});
