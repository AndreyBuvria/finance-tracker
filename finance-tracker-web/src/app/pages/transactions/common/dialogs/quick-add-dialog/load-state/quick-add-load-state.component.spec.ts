import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { QuickAddLoadStateComponent } from './quick-add-load-state.component';

@Component({
  imports: [QuickAddLoadStateComponent],
  template: `<app-quick-add-load-state
    [loading]="loading()"
    [failed]="failed()"
    (retry)="retried = retried + 1"
  />`,
})
class Host {
  readonly loading = signal(true);
  readonly failed = signal(false);
  retried = 0;
}

describe('QuickAddLoadStateComponent', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, host: fixture.componentInstance };
  }

  it('keeps one status region and only changes its text', async () => {
    const { fixture, el, host } = await setup();
    const status = el.querySelector('[role="status"]')!;
    expect(status.textContent?.trim()).toBe('Loading…');
    expect(el.querySelector('.loading')?.getAttribute('aria-hidden')).toBe('true');

    host.loading.set(false);
    await fixture.whenStable();
    expect(el.querySelector('[role="status"]')).toBe(status);
    expect(status.textContent?.trim()).toBe('');
    expect(el.querySelector('.loading')).toBeNull();
  });

  it('offers to try again on failure, and shows the skeleton while retrying', async () => {
    const { fixture, el, host } = await setup();
    host.loading.set(false);
    host.failed.set(true);
    await fixture.whenStable();
    const error = el.querySelector('.load-error[role="alert"]')!;
    expect(error.textContent).toContain('Something went wrong. Try again.');
    error.querySelector<HTMLButtonElement>('button')!.click();
    expect(host.retried).toBe(1);

    host.loading.set(true);
    await fixture.whenStable();
    expect(el.querySelector('.load-error')).toBeNull();
    expect(el.querySelector('.loading')).toBeTruthy();
  });
});
