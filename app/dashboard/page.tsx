'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [dashboards, setDashboards] = useState<any[]>([])
  const [selectedDashboard, setSelectedDashboard] = useState<any | null>(null)

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
  // 4. Logout corrigido
  // -----------------------------
  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')  // ← CORREÇÃO AQUI
  }

  // -----------------------------
  // Renderização
  // -----------------------------
  if (loading) return <p>Carregando dashboards...</p>

  return (
    <div style={{ padding: '24px' }}>
      <h1>Dashboards Disponíveis</h1>

      {/* Seleção do dashboard */}
      {dashboards.length > 0 ? (
        <select
          onChange={e =>
            handleChangeDashboard(
              dashboards.find(d => d.id === e.target.value)
            )
          }
          value={selectedDashboard?.id}
          style={{ padding: '8px', marginBottom: '16px', width: '300px' }}
        >
          {dashboards.map(d => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      ) : (
        <p>Nenhum dashboard permitido para este usuário.</p>
      )}

      {/* Iframe do dashboard */}
      {selectedDashboard && (
        <div
          style={{
            marginTop: '20px',
            border: '1px solid #ccc',
            height: '720px',
            background: '#fff'
          }}
        >
          <iframe
            src={selectedDashboard.url}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </div>
      )}

      {/* Botão de sair */}
      <button
        onClick={handleLogout}
        style={{
          marginTop: '20px',
          padding: '10px 20px',
          cursor: 'pointer'
        }}
      >
        Sair
      </button>
    </div>
  )
}
