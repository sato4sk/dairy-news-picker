'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
  const password = formData.get('password');
  const appPassword = process.env.APP_PASSWORD;

  if (password === appPassword) {
    const cookieStore = await cookies();
    cookieStore.set('auth_session', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });
    redirect('/');
  } else {
    return { error: 'Invalid password' };
  }
}
