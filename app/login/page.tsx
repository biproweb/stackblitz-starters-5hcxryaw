'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    setLoading(false)

    if (error) {
      setError('E-mail ou senha inválidos.')
      return
    }

    router.push('/dashboard')
  }

  return (
    <div style={styles.page}>
      <form onSubmit={handleLogin} style={styles.card}>
        <h1 style={styles.title}>Dashboards</h1>
        <p style={styles.subtitle}>Entre com seu e-mail e senha</p>

        <label style={styles.label}>
          E-mail
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Senha
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={styles.input}
          />
        </label>

        {error && <p style={styles.error}>{error}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    background: '#f3f4f6'
  },
  card: {
    width: '100%',
    maxWidth: 360,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: 28,
    borderRadius: 10,
    background: '#fff',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    color: '#111'
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 600,
    textAlign: 'center',
    color: '#1f2937'
  },
  subtitle: {
    margin: '-6px 0 6px',
    fontSize: 14,
    textAlign: 'center',
    color: '#6b7280'
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 14,
    fontWeight: 500,
    color: '#374151'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 15,
    border: '1px solid #d1d5db',
    borderRadius: 6,
    outline: 'none',
    color: '#111',
    background: '#fff'
  },
  error: {
    margin: 0,
    fontSize: 14,
    color: '#b91c1c'
  },
  button: {
    marginTop: 6,
    padding: '11px',
    fontSize: 15,
    fontWeight: 600,
    border: 'none',
    borderRadius: 6,
    background: '#1f2937',
    color: '#fff',
    cursor: 'pointer'
  }
}
