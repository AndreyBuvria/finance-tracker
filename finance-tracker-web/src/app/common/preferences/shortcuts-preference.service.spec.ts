import { TestBed } from '@angular/core/testing';
import { TokenStorageService } from '../auth/token-storage.service';
import { UserStorageService } from '../auth/user-storage.service';
import { ShortcutsPreferenceService } from './shortcuts-preference.service';

describe('ShortcutsPreferenceService', () => {
  let userId: string | null;

  beforeEach(() => {
    localStorage.clear();
    userId = 'user-1';
    TestBed.configureTestingModule({
      providers: [{ provide: TokenStorageService, useValue: { getUserId: () => userId } }],
    });
  });

  it('has shortcuts on by default', () => {
    expect(TestBed.inject(ShortcutsPreferenceService).enabled()).toBe(true);
  });

  it("keeps the user's choice across reloads", () => {
    TestBed.inject(ShortcutsPreferenceService).setEnabled(false);
    expect(TestBed.inject(ShortcutsPreferenceService).enabled()).toBe(false);

    // A reload: a new service instance reads the stored choice.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: TokenStorageService, useValue: { getUserId: () => userId } }],
    });
    const reloaded = TestBed.inject(ShortcutsPreferenceService);
    expect(reloaded.enabled()).toBe(false);

    reloaded.setEnabled(true);
    expect(reloaded.enabled()).toBe(true);
    expect(localStorage.length).toBe(0);
  });

  it("reads the signed-in user's choice again on load", () => {
    const preference = TestBed.inject(ShortcutsPreferenceService);
    preference.setEnabled(false);
    userId = 'user-2';
    preference.load();
    expect(preference.enabled()).toBe(true);
    userId = 'user-1';
    preference.load();
    expect(preference.enabled()).toBe(false);
  });

  it('is kept across logouts, while session preferences are cleared', () => {
    const preference = TestBed.inject(ShortcutsPreferenceService);
    const storage = TestBed.inject(UserStorageService);
    preference.setEnabled(false);
    storage.set('lastAccountId', 'a1');
    storage.clearAll();
    preference.load();
    expect(preference.enabled()).toBe(false);
    expect(storage.get('lastAccountId')).toBeNull();
  });
});
