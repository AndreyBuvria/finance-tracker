import { TestBed } from '@angular/core/testing';
import { TokenStorageService } from '@common/auth/token-storage.service';
import { ShortcutsPreferenceService } from '@common/preferences/shortcuts-preference.service';
import { ShortcutsSettingComponent } from './shortcuts-setting.component';

describe('ShortcutsSettingComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: TokenStorageService, useValue: { getUserId: () => 'user-1' } }],
    });
  });

  async function setup() {
    const fixture = TestBed.createComponent(ShortcutsSettingComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const toggle = () => el.querySelector<HTMLButtonElement>('button[role="switch"]')!;
    return { fixture, el, toggle };
  }

  it('shows a labelled switch, on by default, with an explanation', async () => {
    const { el, toggle } = await setup();
    expect(el.querySelector('h2')?.textContent?.trim()).toBe('Keyboard shortcuts');
    expect(toggle().getAttribute('aria-checked')).toBe('true');
    const label = el.querySelector(`label[for="${toggle().id}"]`);
    expect(label?.textContent?.trim()).toBe('Single-key shortcuts');
    expect(toggle().getAttribute('aria-describedby')).toContain('shortcuts-hint');
  });

  it('turns shortcuts off and on, and remembers the choice', async () => {
    const { fixture, toggle } = await setup();
    const preference = TestBed.inject(ShortcutsPreferenceService);
    toggle().click();
    await fixture.whenStable();
    expect(preference.enabled()).toBe(false);
    expect(toggle().getAttribute('aria-checked')).toBe('false');

    fixture.destroy();
    const again = await setup();
    expect(again.toggle().getAttribute('aria-checked')).toBe('false');
    again.toggle().click();
    await again.fixture.whenStable();
    expect(preference.enabled()).toBe(true);
  });
});
