import { TestBed } from '@angular/core/testing';
import { UserStorageService } from '@common/auth/user-storage.service';
import { LastAccountService } from './last-account.service';

describe('LastAccountService', () => {
  let stored: Record<string, string>;

  beforeEach(() => {
    stored = {};
    TestBed.configureTestingModule({
      providers: [
        {
          provide: UserStorageService,
          useValue: {
            get: (name: string) => stored[name] ?? null,
            set: (name: string, value: string) => (stored[name] = value),
          },
        },
      ],
    });
  });

  it('remembers the last account per user and picks it while it is active', () => {
    const service = TestBed.inject(LastAccountService);
    expect(service.pick(['a1', 'a2'])).toBe('a1');
    service.set('a2');
    expect(stored).toEqual({ lastAccountId: 'a2' });
    expect(service.pick(['a1', 'a2'])).toBe('a2');
  });

  it('falls back to the first active account for an archived one', () => {
    const service = TestBed.inject(LastAccountService);
    service.set('archived');
    expect(service.pick(['a1', 'a2'])).toBe('a1');
    expect(service.pick([])).toBe('');
  });
});
