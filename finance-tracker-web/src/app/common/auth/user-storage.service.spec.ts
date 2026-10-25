import { TestBed } from '@angular/core/testing';
import { TokenStorageService } from './token-storage.service';
import { UserStorageService } from './user-storage.service';

describe('UserStorageService', () => {
  let userId: string | null;

  beforeEach(() => {
    localStorage.clear();
    userId = 'user-1';
    TestBed.configureTestingModule({
      providers: [{ provide: TokenStorageService, useValue: { getUserId: () => userId } }],
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('keeps values per user', () => {
    const storage = TestBed.inject(UserStorageService);
    storage.set('lastAccountId', 'a1');
    expect(storage.get('lastAccountId')).toBe('a1');
    userId = 'user-2';
    expect(storage.get('lastAccountId')).toBeNull();
  });

  it('removes one value of the signed-in user only', () => {
    const storage = TestBed.inject(UserStorageService);
    storage.set('lastAccountId', 'a1');
    userId = 'user-2';
    storage.set('lastAccountId', 'a2');
    storage.remove('lastAccountId');
    expect(storage.get('lastAccountId')).toBeNull();
    userId = 'user-1';
    expect(storage.get('lastAccountId')).toBe('a1');
  });

  it('remembers nothing without a signed-in user', () => {
    userId = null;
    const storage = TestBed.inject(UserStorageService);
    storage.set('lastAccountId', 'a1');
    expect(localStorage.length).toBe(0);
    expect(storage.get('lastAccountId')).toBeNull();
  });

  it('keeps device values per user, apart from session values', () => {
    const storage = TestBed.inject(UserStorageService);
    storage.set('choice', 'device-1', 'device');
    storage.set('choice', 'session-1');
    expect(storage.get('choice', 'device')).toBe('device-1');
    expect(storage.get('choice')).toBe('session-1');
    userId = 'user-2';
    expect(storage.get('choice', 'device')).toBeNull();
    userId = 'user-1';
    storage.remove('choice', 'device');
    expect(storage.get('choice', 'device')).toBeNull();
    expect(storage.get('choice')).toBe('session-1');
  });

  it('keeps device values on logout and clears session values', () => {
    const storage = TestBed.inject(UserStorageService);
    storage.set('shortcutsDisabled', 'true', 'device');
    storage.set('lastAccountId', 'a1');
    storage.clearAll();
    expect(storage.get('shortcutsDisabled', 'device')).toBe('true');
    expect(storage.get('lastAccountId')).toBeNull();
  });

  it('clears every user preference but nothing else', () => {
    const storage = TestBed.inject(UserStorageService);
    storage.set('lastAccountId', 'a1');
    localStorage.setItem('ft.refreshToken', 'r');
    storage.clearAll();
    expect(storage.get('lastAccountId')).toBeNull();
    expect(localStorage.getItem('ft.refreshToken')).toBe('r');
  });

  it('works without storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const storage = TestBed.inject(UserStorageService);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => storage.set('x', 'y')).not.toThrow();
    expect(() => storage.remove('x')).not.toThrow();
    expect(storage.get('x')).toBeNull();
  });
});
