import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LoadErrorComponent } from './load-error.component';

@Component({
  imports: [LoadErrorComponent],
  template: `<app-load-error [errorId]="errorId()" (retry)="retries = retries + 1" />`,
})
class Host {
  readonly errorId = signal<string | null>('7f3a-91c2');
  retries = 0;
}

describe('LoadErrorComponent', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
  }

  it('announces the generic message with the error ID', async () => {
    const { el } = await setup();
    expect(el.querySelector('[role="alert"] .message')?.textContent).toBe(
      'Something went wrong. Try again.',
    );
    expect(el.querySelector('.error-id')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Error ID: 7f3a-91c2',
    );
  });

  it('hides the error ID when there is none', async () => {
    const { el, fixture, host } = await setup();
    host.errorId.set(null);
    await fixture.whenStable();
    expect(el.querySelector('.error-id')).toBeNull();
  });

  it('reports "Try again"', async () => {
    const { el, host } = await setup();
    el.querySelector<HTMLButtonElement>('button')!.click();
    expect(host.retries).toBe(1);
  });
});
