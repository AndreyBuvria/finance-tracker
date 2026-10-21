import { AppRoutesEnum } from './app-routes.enum';
import { routeSegment } from './app-routes.utils';

describe('routeSegment', () => {
  it('turns an absolute route into a root route path', () => {
    expect(routeSegment(AppRoutesEnum.Dashboard)).toBe('dashboard');
    expect(routeSegment(AppRoutesEnum.Auth)).toBe('auth');
  });

  it('turns a feature child route into a path relative to its parent', () => {
    expect(routeSegment(AppRoutesEnum.Login, AppRoutesEnum.Auth)).toBe('login');
    expect(routeSegment(AppRoutesEnum.Register, AppRoutesEnum.Auth)).toBe('register');
  });

  it('rejects a route that is not under the given parent', () => {
    expect(() => routeSegment(AppRoutesEnum.Dashboard, AppRoutesEnum.Auth)).toThrow();
  });
});
