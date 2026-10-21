import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FakeClockService, provideFakeClock } from '../time/testing/fake-clock.service';
import { TokenStorageService } from './token-storage.service';

describe('TokenStorageService', () => {
  let clock: FakeClockService;
  let storage: TokenStorageService;

  beforeEach(() => {
    localStorage.clear();
    clock = new FakeClockService('2026-10-21T10:00:00');
    TestBed.configureTestingModule({ providers: [provideFakeClock(clock)] });
    storage = TestBed.inject(TokenStorageService);
  });

  it('keeps the access token in memory and the refresh token in localStorage', () => {
    storage.save({ accessToken: 'access-1', expiresIn: 900, refreshToken: 'refresh-1' });
    expect(storage.getAccessToken()).toBe('access-1');
    expect(storage.getRefreshToken()).toBe('refresh-1');
    expect(Object.values(localStorage)).toEqual(['refresh-1']);
  });

  it('treats the access token as expired 30 seconds before it expires', () => {
    storage.save({ accessToken: 'access-1', expiresIn: 900, refreshToken: 'refresh-1' });
    clock.advanceBy(869_000);
    expect(storage.getAccessToken()).toBe('access-1');
    clock.advanceBy(1_000);
    expect(storage.getAccessToken()).toBeNull();
    expect(storage.getRefreshToken()).toBe('refresh-1');
  });

  it('survives a reload with the refresh token only', () => {
    storage.save({ accessToken: 'access-1', expiresIn: 900, refreshToken: 'refresh-1' });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideFakeClock(clock)] });
    const reloaded = TestBed.inject(TokenStorageService);
    expect(reloaded.getAccessToken()).toBeNull();
    expect(reloaded.getRefreshToken()).toBe('refresh-1');
  });

  it('clears both tokens', () => {
    storage.save({ accessToken: 'access-1', expiresIn: 900, refreshToken: 'refresh-1' });
    storage.clear();
    expect(storage.getAccessToken()).toBeNull();
    expect(storage.getRefreshToken()).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  describe('when localStorage is blocked', () => {
    function blockedStorage(): TokenStorageService {
      // Some browsers throw a SecurityError as soon as `window.localStorage` is read.
      const window = {};
      Object.defineProperty(window, 'localStorage', {
        get: () => {
          throw new DOMException('The operation is insecure.', 'SecurityError');
        },
      });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideFakeClock(clock),
          { provide: DOCUMENT, useValue: { defaultView: window } },
        ],
      });
      return TestBed.inject(TokenStorageService);
    }

    it('can be created and reports no session', () => {
      const blocked = blockedStorage();
      expect(blocked.getRefreshToken()).toBeNull();
      expect(blocked.getAccessToken()).toBeNull();
    });

    it('keeps the session in memory until reload', () => {
      const blocked = blockedStorage();
      blocked.save({ accessToken: 'access-1', expiresIn: 900, refreshToken: 'refresh-1' });
      expect(blocked.getAccessToken()).toBe('access-1');
      expect(blocked.getRefreshToken()).toBe('refresh-1');
      blocked.clear();
      expect(blocked.getAccessToken()).toBeNull();
      expect(blocked.getRefreshToken()).toBeNull();
    });
  });

  it('falls back to memory when writing fails (quota exceeded)', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    storage.save({ accessToken: 'access-1', expiresIn: 900, refreshToken: 'refresh-1' });
    expect(storage.getRefreshToken()).toBe('refresh-1');
    expect(localStorage.length).toBe(0);
    setItem.mockRestore();
  });

  it('never returns a rotated (stale) refresh token when a later write fails', () => {
    storage.save({ accessToken: 'access-1', expiresIn: 900, refreshToken: 'refresh-1' });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    storage.save({ accessToken: 'access-2', expiresIn: 900, refreshToken: 'refresh-2' });
    expect(storage.getRefreshToken()).toBe('refresh-2');
    expect(localStorage.getItem('ft.refreshToken')).toBeNull();

    // After a reload the in-memory token is gone, and the revoked one must not come back.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideFakeClock(clock)] });
    expect(TestBed.inject(TokenStorageService).getRefreshToken()).toBeNull();
    setItem.mockRestore();
  });

  it('prefers the in-memory token even if the stale one could not be removed', () => {
    storage.save({ accessToken: 'access-1', expiresIn: 900, refreshToken: 'refresh-1' });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Broken', 'UnknownError');
    });
    storage.save({ accessToken: 'access-2', expiresIn: 900, refreshToken: 'refresh-2' });
    expect(storage.getRefreshToken()).toBe('refresh-2');
    setItem.mockRestore();
    removeItem.mockRestore();

    storage.clear();
    expect(storage.getRefreshToken()).toBeNull();
    expect(localStorage.length).toBe(0);
  });
});
