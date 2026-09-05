import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'register') {
        await register(displayName, email, password, confirmPassword);
      } else {
        await login(email, password);
      }
      window.history.pushState({}, '', '/dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Unable to authenticate'
      );
    } finally {
      setSubmitting(false);
    }
  }

  const isRegister = mode === 'register';

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-10" style={{ backgroundColor: 'var(--bg)' }}>
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl border p-6" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
        <div className="mb-6">
          <div className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>MarketPulse</div>
          <div className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {isRegister ? 'Create your personal market dashboard.' : 'Sign in to your market dashboard.'}
          </div>
        </div>

        {isRegister && (
          <label className="block text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Display name
            <input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2.5" style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          </label>
        )}

        <label className="block text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Email
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2.5" style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
        </label>

        <label className="block text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Password
          <input required type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2.5" style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
        </label>

        {isRegister && (
          <label className="block text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Confirm password
            <input required type="password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2.5" style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          </label>
        )}

        {error && <div className="mb-4 rounded-lg px-3 py-2 text-sm" style={{ color: 'var(--attention)', backgroundColor: 'var(--attention-soft)' }}>{error}</div>}

        <button disabled={submitting} className="w-full rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-60" style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-on)' }}>
          {submitting ? 'Please wait...' : isRegister ? 'Register' : 'Login'}
        </button>

        <p className="mt-5 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          {isRegister ? 'Already have an account? ' : 'Need an account? '}
          <a className="font-medium" style={{ color: 'var(--brand)' }} href={isRegister ? '/login' : '/register'}>
            {isRegister ? 'Login' : 'Register'}
          </a>
        </p>
      </form>
    </main>
  );
}
