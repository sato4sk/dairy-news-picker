import { beforeEach, describe, expect, it, vi } from 'vitest';

const cookieSet = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn(() => {
  throw new Error('NEXT_REDIRECT');
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ set: cookieSet })),
}));

vi.mock('next/navigation', () => ({
  redirect,
}));

import { login } from '../actions';

describe('login action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_PASSWORD = 'secret';
  });

  it('sets an auth cookie and redirects when the password matches', async () => {
    const formData = new FormData();
    formData.set('password', 'secret');

    await expect(login(formData)).rejects.toThrow('NEXT_REDIRECT');

    expect(cookieSet).toHaveBeenCalledWith('auth_session', 'true', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    expect(redirect).toHaveBeenCalledWith('/');
  });

  it('returns an error when the password does not match', async () => {
    const formData = new FormData();
    formData.set('password', 'wrong');

    await expect(login(formData)).resolves.toEqual({ error: 'Invalid password' });
    expect(cookieSet).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
