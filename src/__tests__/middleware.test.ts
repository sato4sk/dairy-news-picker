import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

function request(path: string, cookie?: string) {
  return new NextRequest(`https://example.com${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

describe('middleware', () => {
  it('allows public and static paths', () => {
    expect(middleware(request('/login')).headers.get('x-middleware-next')).toBe('1');
    expect(middleware(request('/_next/static/app.js')).headers.get('x-middleware-next')).toBe('1');
    expect(middleware(request('/favicon.ico')).headers.get('x-middleware-next')).toBe('1');
  });

  it('redirects unauthenticated protected pages to login', () => {
    const response = middleware(request('/settings'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/login');
  });

  it('allows protected pages when auth_session exists', () => {
    const response = middleware(request('/settings', 'auth_session=true'));

    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
});
