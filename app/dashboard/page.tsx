'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

const HEADER_HEIGHT = 48

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [dashboards, setDashboards] = useState<any[]>([])
  const [selectedDashboard, setSelectedDashboard] = useState<any | null>(null)
  const frameAreaRef = useRef<HTMLDivElement>(null)

  // -----------------------------
  // 1. Validar sessão e buscar dashboards permitidos
  // -----------------------------
  useEffect(() => {
    async function loadData() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      const userId = session.user.id

      // Buscar dashboards permitidos
      const { data: allowedDashboards, error } = await supabase
        .from('user_dashboards')
        .select(
          `
          dashboard_id,
          dashboards (
            id,
            name,
            description,
            url
          )
        `
        )
        .eq('user_id', userId)
        .eq('allowed', true)

      if (error) {
        console.error(error)
        return
      }

      const dashboardsList = allowedDashboards.map(d => d.dashboards)

      setDashboards(dashboardsList)
      setSelectedDashboard(dashboardsList[0]) // seleciona o primeiro dashboard
      setLoading(false)
    }

    loadData()
  }, [router])

  // -----------------------------
  // 2. Registrar log de acesso
  // -----------------------------
  async function registerAccess(dashboardName: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    await fetch('/api/log-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        dashboard_name: dashboardName
      })
    })
  }

  // -----------------------------
  // 3. Trocar dashboard selecionado
  // -----------------------------
  async function handleChangeDashboard(d: any) {
    setSelectedDashboard(d)
    registerAccess(d.name)
  }

  // -----------------------------
  // 4. Logout
  // -----------------------------
  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // -----------------------------
  // 5. Tela cheia (somente a área do relatório)
  // -----------------------------
  function handleFullscreen() {
    const el = frameAreaRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      el.requestFullscreen?.()
    }
  }

  // -----------------------------
  // Renderização
  // -----------------------------
  if (loading) {
    return (
      <div style={styles.page}>
        <p style={{ margin: 'auto', color: '#555' }}>Carregando dashboards...</p>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      {/* Barra superior compacta */}
      <header style={styles.header}>
        <span style={styles.brand}>Dashboards</span>

        {dashboards.length > 0 ? (
          <select
            onChange={e =>
              handleChangeDashboard(
                dashboards.find(d => d.id === e.target.value)
              )
            }
            value={selectedDashboard?.id}
            style={styles.select}
          >
            {dashboards.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        ) : (
          <span>Nenhum dashboard permitido para este usuário.</span>
        )}

        <div style={styles.actions}>
          {selectedDashboard && (
            <button
              onClick={handleFullscreen}
              style={styles.button}
              title="Exibir o relatório em tela cheia (Esc para sair)"
            >
              ⛶ Tela cheia
            </button>
          )}
          <button onClick={handleLogout} style={styles.button}>
            Sair
          </button>
        </div>
      </header>

      {/* Área do relatório: ocupa todo o espaço restante */}
      {selectedDashboard && (
        <div ref={frameAreaRef} style={styles.frameArea}>
          <iframe
            key={selectedDashboard.id}
            src={selectedDashboard.url}
            title={selectedDashboard.name}
            allowFullScreen
            style={styles.iframe}
          />
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    height: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: '#202020'
  },
  header: {
    height: HEADER_HEIGHT,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0 12px',
    background: '#1f2937',
    color: '#fff'
  },
  brand: {
    fontWeight: 600,
    whiteSpace: 'nowrap'
  },
  select: {
    padding: '6px 8px',
    minWidth: 260,
    maxWidth: '50vw',
    borderRadius: 4,
    border: 'none',
    color: '#111',
    background: '#fff'
  },
  actions: {
    marginLeft: 'auto',
    display: 'flex',
    gap: 8
  },
  button: {
    padding: '6px 14px',
    borderRadius: 4,
    border: '1px solid rgba(255,255,255,0.35)',
    background: 'transparent',
    color: '#fff',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  frameArea: {
    flex: 1,
    minHeight: 0,
    background: '#202020'
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    display: 'block'
  }
}
