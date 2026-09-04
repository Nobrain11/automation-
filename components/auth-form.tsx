'use client'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter(); const [error, setError] = useState(''); const [pending, setPending] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); setError(''); const data = new FormData(event.currentTarget); const result = mode === 'sign-up' ? await authClient.signUp.email({ name: String(data.get('name')), email: String(data.get('email')), password: String(data.get('password')) }) : await authClient.signIn.email({ email: String(data.get('email')), password: String(data.get('password')) }); setPending(false); if (result.error) { setError('Unable to authenticate with those details.'); return } router.push('/'); router.refresh() }
  return <main className="auth-shell"><form className="auth-card" onSubmit={submit}><span className="eyebrow">PUMP AUTO / ACCESS</span><h1>{mode === 'sign-up' ? 'Create operator account' : 'Sign in to terminal'}</h1><p>Secure access for your trading workspace.</p>{mode === 'sign-up' && <label>Name<input name="name" required autoComplete="name" /></label>}<label>Email<input name="email" type="email" required autoComplete="email" /></label><label>Password<input name="password" type="password" minLength={8} required autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary-button" disabled={pending}>{pending ? 'Authenticating…' : mode === 'sign-up' ? 'Create account' : 'Sign in'}</button><a href={mode === 'sign-up' ? '/sign-in' : '/sign-up'}>{mode === 'sign-up' ? 'Already have an account? Sign in' : 'Need an account? Create one'}</a></form></main>
}
