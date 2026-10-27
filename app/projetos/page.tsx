'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import s from './projetos.module.css'

// -----------------------------
// Tipos e rótulos
// -----------------------------
type Status = 'andamento' | 'fila' | 'pausado' | 'concluido'
type Prioridade = 'alta' | 'media' | 'baixa'
type EtapaStatus = 'pendente' | 'andamento' | 'feito'

type Etapa = { nome: string; status: EtapaStatus; inicio: string; fim: string }

type Projeto = {
  id: string
  nome: string
  setor: string | null
  solicitante: string | null
  status: Status
  prioridade: Prioridade
  inicio: string | null
  previsao: string | null
  conclusao: string | null
  descricao: string | null
  ordem: number | null
  etapas: Etapa[]
  atualizado_em: string
}

type Solicitacao = {
  id: string
  titulo: string
  setor: string
  solicitante: string
  prazo: string | null
  prioridade: Prioridade
  descricao: string | null
  situacao: 'nova' | 'aceita' | 'arquivada'
  criado_em: string
}

const STATUS: Record<Status, string> = {
  andamento: 'Em andamento',
  fila: 'Na fila',
  pausado: 'Pausado',
  concluido: 'Concluído'
}
const PRIO: Record<Prioridade, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }
const ETST: Record<EtapaStatus, string> = {
  pendente: 'Pendente',
  andamento: 'Em andamento',
  feito: 'Concluída'
}

// -----------------------------
// Datas (sempre 'AAAA-MM-DD', sem fuso)
// -----------------------------
const DAY = 864e5
function parseDate(v?: string | null): Date | null {
  if (!v) return null
  const [y, m, d] = v.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}
function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function today() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
function fmtShort(v?: string | null) {
  const d = parseDate(v)
  return d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''
}
function fmtLong(v?: string | null) {
  const d = parseDate(v)
  return d
    ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')
    : ''
}
function mondayOf(d: Date) {
  const x = new Date(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

function percentual(p: Projeto) {
  const e = p.etapas || []
  if (!e.length) return p.status === 'concluido' ? 100 : 0
  const soma = e.reduce((t, x) => t + (x.status === 'feito' ? 1 : x.status === 'andamento' ? 0.5 : 0), 0)
  return Math.round((soma / e.length) * 100)
}

// =====================================================================
export default function ProjetosPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([])
  const [editando, setEditando] = useState<Projeto | 'novo' | null>(null)
  const [solicitando, setSolicitando] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<string | null>(null)

  const avisar = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
  }, [])

  const carregar = useCallback(async () => {
    const [p, sol] = await Promise.all([
      supabase.from('projetos_bi').select('*'),
      supabase.from('solicitacoes_bi').select('*').eq('situacao', 'nova')
    ])
    if (p.error || sol.error) {
      setErro('Não foi possível carregar os projetos. Verifique se o script projetos_bi.sql foi executado no Supabase.')
      console.error(p.error || sol.error)
      return
    }
    setErro(null)
    setProjetos((p.data as Projeto[]).map(x => ({ ...x, etapas: Array.isArray(x.etapas) ? x.etapas : [] })))
    setSolicitacoes(sol.data as Solicitacao[])
  }, [])

  // Sessão, permissão de administrador e dados
  useEffect(() => {
    async function init() {
      const {
        data: { session }
      } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      const { data: admin } = await supabase
        .from('portal_admins')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle()
      setIsAdmin(!!admin)
      await carregar()
      setLoading(false)
    }
    init()
  }, [router, carregar])

  // Atualiza sozinho quando a aba volta ao foco
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'visible') carregar()
    }
    document.addEventListener('visibilitychange', onFocus)
    return () => document.removeEventListener('visibilitychange', onFocus)
  }, [carregar])

  const andamento = useMemo(
    () =>
      projetos
        .filter(p => p.status === 'andamento' || p.status === 'pausado')
        .sort(
          (a, b) =>
            Number(a.status === 'pausado') - Number(b.status === 'pausado') ||
            (a.inicio || '').localeCompare(b.inicio || '')
        ),
    [projetos]
  )
  const fila = useMemo(
    () => projetos.filter(p => p.status === 'fila').sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999)),
    [projetos]
  )
  const concluidos = useMemo(
    () =>
      projetos
        .filter(p => p.status === 'concluido')
        .sort((a, b) => (b.conclusao || '').localeCompare(a.conclusao || '')),
    [projetos]
  )
  const solicitacoesOrd = useMemo(
    () => [...solicitacoes].sort((a, b) => b.criado_em.localeCompare(a.criado_em)),
    [solicitacoes]
  )
  const anoAtual = String(new Date().getFullYear())
  const ultimaAtualizacao = projetos.map(p => p.atualizado_em).sort().pop()

  function proximaOrdem() {
    return Math.max(0, ...fila.map(p => p.ordem || 0)) + 1
  }

  // -----------------------------
  // Ações
  // -----------------------------
  async function executar(fn: () => PromiseLike<{ error: any }>, ok: string) {
    const { error } = await fn()
    if (error) {
      console.error(error)
      avisar('Não foi possível concluir: ' + error.message)
      return false
    }
    avisar(ok)
    await carregar()
    return true
  }

  async function iniciar(p: Projeto) {
    await executar(
      () =>
        supabase
          .from('projetos_bi')
          .update({ status: 'andamento', inicio: p.inicio || isoDate(today()), atualizado_em: new Date().toISOString() })
          .eq('id', p.id),
      'Projeto iniciado'
    )
  }

  async function mover(p: Projeto, dir: -1 | 1) {
    const i = fila.findIndex(x => x.id === p.id)
    const j = i + dir
    if (j < 0 || j >= fila.length) return
    const nova = [...fila]
    ;[nova[i], nova[j]] = [nova[j], nova[i]]
    const r1 = await supabase.from('projetos_bi').update({ ordem: i + 1 }).eq('id', nova[i].id)
    const r2 = await supabase.from('projetos_bi').update({ ordem: j + 1 }).eq('id', nova[j].id)
    if (r1.error || r2.error) avisar('Não foi possível reordenar a fila.')
    await carregar()
  }

  async function aceitar(sol: Solicitacao) {
    const { error } = await supabase.from('projetos_bi').insert({
      nome: sol.titulo,
      setor: sol.setor,
      solicitante: sol.solicitante,
      status: 'fila',
      prioridade: sol.prioridade,
      previsao: sol.prazo,
      descricao: sol.descricao || '',
      etapas: [],
      ordem: proximaOrdem()
    })
    if (error) {
      avisar('Não foi possível colocar na fila: ' + error.message)
      return
    }
    await executar(
      () => supabase.from('solicitacoes_bi').update({ situacao: 'aceita' }).eq('id', sol.id),
      'Solicitação colocada na fila'
    )
  }

  async function arquivar(sol: Solicitacao) {
    if (confirmar !== sol.id) {
      setConfirmar(sol.id)
      return
    }
    setConfirmar(null)
    await executar(
      () => supabase.from('solicitacoes_bi').update({ situacao: 'arquivada' }).eq('id', sol.id),
      'Solicitação arquivada'
    )
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // -----------------------------
  // Renderização
  // -----------------------------
  return (
    <div className={s.page}>
      <header className={s.header}>
        <span className={s.brand}>Projetos BI</span>
        <div className={s.headerActions}>
          <button className={s.headerBtn} onClick={() => router.push('/dashboard')}>
            ← Dashboards
          </button>
          <button className={s.headerBtn} onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      {loading ? (
        <p className={s.loading}>Carregando projetos...</p>
      ) : (
        <main className={s.wrap}>
          <div className={s.top}>
            <div>
              <div className={s.eyebrow}>Terra Premium · BI e Dados</div>
              <h1 className={s.title}>Portal de Projetos BI</h1>
              <div className={s.metaLine}>
                {ultimaAtualizacao
                  ? 'Última atualização: ' +
                    new Date(ultimaAtualizacao).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                  : 'Nenhum projeto cadastrado ainda'}
              </div>
            </div>
            <div className={s.actions}>
              <button className={s.btn} onClick={() => setSolicitando(true)}>
                Solicitar demanda
              </button>
              {isAdmin && (
                <button className={`${s.btn} ${s.primary}`} onClick={() => setEditando('novo')}>
                  Novo projeto
                </button>
              )}
            </div>
          </div>

          {erro && <div className={s.empty}>{erro}</div>}

          <section className={s.summary} aria-label="Resumo">
            <div>
              <b>{projetos.filter(p => p.status === 'andamento').length}</b>
              <span>em andamento</span>
            </div>
            <div>
              <b>{fila.length}</b>
              <span>na fila</span>
            </div>
            <div>
              <b>{solicitacoes.length}</b>
              <span>solicitações a avaliar</span>
            </div>
            <div>
              <b>{concluidos.filter(p => (p.conclusao || '').startsWith(anoAtual)).length}</b>
              <span>concluídos no ano</span>
            </div>
          </section>

          {/* Em andamento */}
          <section>
            <div className={s.secHead}>
              <h2 className={s.h2}>
                Em andamento <span className={s.count}>{andamento.length || ''}</span>
              </h2>
            </div>
            {andamento.length ? (
              <div className={s.cards}>
                {andamento.map(p => (
                  <CartaoProjeto key={p.id} p={p} isAdmin={isAdmin} onEdit={() => setEditando(p)} />
                ))}
              </div>
            ) : (
              <div className={s.empty}>
                Nenhum projeto em andamento.
                {isAdmin && ' Use "Novo projeto" ou inicie um item da fila.'}
              </div>
            )}
          </section>

          {/* Cronograma */}
          <section>
            <div className={s.secHead}>
              <h2 className={s.h2}>Cronograma</h2>
              <span className={s.note}>Barra esmaecida = sem previsão de término</span>
            </div>
            <Cronograma lista={[...andamento, ...fila]} />
            <div className={s.legend}>
              {(Object.keys(STATUS) as Status[]).map(k => (
                <span key={k} className={`${s.pill} ${s['s_' + k]}`}>
                  {STATUS[k]}
                </span>
              ))}
            </div>
          </section>

          {/* Fila */}
          <section>
            <div className={s.secHead}>
              <h2 className={s.h2}>
                Fila de projetos <span className={s.count}>{fila.length || ''}</span>
              </h2>
              <span className={s.note}>Ordem de execução prevista</span>
            </div>
            {fila.length ? (
              <div className={s.list}>
                {fila.map((p, i) => (
                  <div key={p.id} className={s.row}>
                    <span className={s.pos}>{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <div className={s.rowTitle}>{p.nome}</div>
                      <div className={s.sub}>
                        {[p.setor, p.solicitante, p.previsao ? 'previsão ' + fmtLong(p.previsao) : '']
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <div className={s.ctl}>
                      <span className={`${s.pill} ${s['p_' + p.prioridade]}`}>{PRIO[p.prioridade]}</span>
                      {isAdmin && (
                        <>
                          <button
                            className={`${s.btn} ${s.ghost}`}
                            aria-label="Subir na fila"
                            disabled={i === 0}
                            onClick={() => mover(p, -1)}
                          >
                            ↑
                          </button>
                          <button
                            className={`${s.btn} ${s.ghost}`}
                            aria-label="Descer na fila"
                            disabled={i === fila.length - 1}
                            onClick={() => mover(p, 1)}
                          >
                            ↓
                          </button>
                          <button className={s.btn} onClick={() => iniciar(p)}>
                            Iniciar
                          </button>
                          <button className={`${s.btn} ${s.ghost}`} onClick={() => setEditando(p)}>
                            Editar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={s.empty}>
                Fila vazia.{' '}
                {isAdmin
                  ? 'Cadastre um projeto com status "Na fila" ou aceite uma solicitação abaixo.'
                  : 'Novos projetos aparecem aqui quando forem programados.'}
              </div>
            )}
          </section>

          {/* Solicitações */}
          <section>
            <div className={s.secHead}>
              <h2 className={s.h2}>
                Solicitações dos setores <span className={s.count}>{solicitacoes.length || ''}</span>
              </h2>
              <span className={s.note}>Pedidos recebidos que ainda não entraram na fila</span>
            </div>
            {solicitacoesOrd.length ? (
              <div className={s.list}>
                {solicitacoesOrd.map(sol => (
                  <div key={sol.id} className={s.row}>
                    <span className={s.pos}>{fmtShort(sol.criado_em)}</span>
                    <div>
                      <div className={s.rowTitle}>{sol.titulo}</div>
                      <div className={s.sub}>
                        {sol.setor} · {sol.solicitante}
                        {sol.prazo ? ' · precisa até ' + fmtLong(sol.prazo) : ''}
                      </div>
                      {sol.descricao && <div className={s.sub}>{sol.descricao}</div>}
                    </div>
                    <div className={s.ctl}>
                      <span className={`${s.pill} ${s['p_' + sol.prioridade]}`}>{PRIO[sol.prioridade]}</span>
                      {isAdmin ? (
                        <>
                          <button className={s.btn} onClick={() => aceitar(sol)}>
                            Colocar na fila
                          </button>
                          <button className={`${s.btn} ${s.ghost}`} onClick={() => arquivar(sol)}>
                            {confirmar === sol.id ? 'Confirmar' : 'Arquivar'}
                          </button>
                        </>
                      ) : (
                        <span className={`${s.pill} ${s.s_fila}`}>Aguardando avaliação</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={s.empty}>
                Nenhuma solicitação pendente. Para pedir um painel ou relatório, use &quot;Solicitar demanda&quot;.
              </div>
            )}
          </section>

          {/* Concluídos */}
          <section>
            <div className={s.secHead}>
              <h2 className={s.h2}>
                Concluídos <span className={s.count}>{concluidos.length || ''}</span>
              </h2>
            </div>
            {concluidos.length ? (
              <div className={s.list}>
                {concluidos.map(p => (
                  <div key={p.id} className={s.row}>
                    <span className={s.pos}>✓</span>
                    <div>
                      <div className={s.rowTitle}>{p.nome}</div>
                      <div className={s.sub}>
                        {p.setor}
                        {p.inicio ? ' · ' + fmtLong(p.inicio) : ''}
                        {p.conclusao ? ' → ' + fmtLong(p.conclusao) : ''}
                      </div>
                    </div>
                    <div className={s.ctl}>
                      {isAdmin && (
                        <button className={`${s.btn} ${s.ghost}`} onClick={() => setEditando(p)}>
                          Editar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={s.empty}>Os projetos entregues ficam registrados aqui.</div>
            )}
          </section>
        </main>
      )}

      {editando && (
        <EditorProjeto
          projeto={editando === 'novo' ? null : editando}
          proximaOrdem={proximaOrdem()}
          onClose={() => setEditando(null)}
          onSaved={async msg => {
            setEditando(null)
            avisar(msg)
            await carregar()
          }}
          onError={avisar}
        />
      )}

      {solicitando && (
        <FormSolicitacao
          onClose={() => setSolicitando(false)}
          onSent={async () => {
            setSolicitando(false)
            avisar('Solicitação enviada')
            await carregar()
          }}
          onError={avisar}
        />
      )}

      {toast && <div className={s.toast}>{toast}</div>}
    </div>
  )
}

// =====================================================================
function CartaoProjeto({ p, isAdmin, onEdit }: { p: Projeto; isAdmin: boolean; onEdit: () => void }) {
  const v = percentual(p)
  return (
    <article className={s.card}>
      <div className={s.cardTop}>
        <div style={{ minWidth: 0 }}>
          <div className={s.eyebrow}>{p.setor}</div>
          <h3 className={s.cardTitle}>{p.nome}</h3>
        </div>
        <div className={s.tags}>
          <span className={`${s.pill} ${s['s_' + p.status]}`}>{STATUS[p.status]}</span>
          <span className={`${s.pill} ${s['p_' + p.prioridade]}`}>{PRIO[p.prioridade]}</span>
        </div>
      </div>
      {p.descricao && <p className={s.desc}>{p.descricao}</p>}
      <div className={s.progress}>
        <div className={s.bar}>
          <i style={{ width: v + '%' }} />
        </div>
        <b>{v}%</b>
      </div>
      {p.etapas.length > 0 && (
        <ol className={s.steps}>
          {p.etapas.map((e, i) => (
            <li key={i} className={s['st_' + e.status]}>
              <span className={s.dot}>{e.status === 'feito' ? '✓' : ''}</span>
              <span className={s.stepName}>{e.nome}</span>
              <span className={s.stepDate}>
                {e.status === 'feito' && e.fim
                  ? 'entregue ' + fmtShort(e.fim)
                  : e.status === 'andamento'
                  ? e.inicio
                    ? 'desde ' + fmtShort(e.inicio)
                    : 'em curso'
                  : e.fim
                  ? 'prev. ' + fmtShort(e.fim)
                  : ''}
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className={s.cardFoot}>
        <span className={s.metaLine}>
          {p.inicio ? 'Início ' + fmtLong(p.inicio) : ''}
          {p.previsao ? ' · Previsão ' + fmtLong(p.previsao) : ' · Sem previsão de término'}
        </span>
        {isAdmin && (
          <button className={`${s.btn} ${s.ghost}`} onClick={onEdit}>
            Editar
          </button>
        )}
      </div>
    </article>
  )
}

// =====================================================================
function Cronograma({ lista }: { lista: Projeto[] }) {
  const t = today()
  let inicio = mondayOf(new Date(t.getTime() - 21 * DAY))
  lista.forEach(p => {
    const d = parseDate(p.inicio)
    if (d && d < inicio) inicio = mondayOf(d)
  })
  let semanas = 12
  lista.forEach(p => {
    const d = parseDate(p.previsao)
    if (d && d.getTime() > inicio.getTime() + semanas * 7 * DAY)
      semanas = Math.min(26, Math.ceil((d.getTime() - inicio.getTime()) / (7 * DAY)) + 1)
  })
  const span = semanas * 7 * DAY
  const pos = (d: Date) => Math.max(0, Math.min(100, ((d.getTime() - inicio.getTime()) / span) * 100))
  const colunas = Array.from({ length: semanas }, (_, i) => new Date(inicio.getTime() + i * 7 * DAY))

  const grade = (
    <div className={s.gGrid}>
      {colunas.map((_, i) => (
        <span key={i} />
      ))}
    </div>
  )
  const hoje = <div className={s.gToday} style={{ left: pos(t) + '%' }} />

  return (
    <div className={s.ganttBox}>
      <div className={s.gantt}>
        <div className={s.gRow}>
          <div className={`${s.gLabel} ${s.eyebrow}`}>Projeto</div>
          <div className={`${s.gTrack} ${s.gHead}`}>
            {colunas.map((d, i) => (
              <span key={i}>{d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
            ))}
          </div>
        </div>
        {lista.length === 0 && (
          <div className={s.gRow}>
            <div className={s.gLabel}>—</div>
            <div className={s.gTrack}>
              {grade}
              {hoje}
            </div>
          </div>
        )}
        {lista.map(p => {
          const ini = parseDate(p.inicio) || t
          const aberto = !p.previsao
          const fim = parseDate(p.previsao) || new Date(Math.max(t.getTime(), ini.getTime()) + 21 * DAY)
          const l = pos(ini)
          const w = Math.max(1.5, pos(fim) - l)
          return (
            <div key={p.id} className={s.gRow}>
              <div className={s.gLabel} title={p.nome}>
                {p.nome}
              </div>
              <div className={s.gTrack}>
                {grade}
                <div
                  className={`${s.gBar} ${s['g_' + p.status]} ${aberto ? s.gOpen : ''}`}
                  style={{ left: l + '%', width: w + '%' }}
                >
                  {p.status === 'fila' && !p.inicio ? 'a programar' : percentual(p) + '%'}
                </div>
                {hoje}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =====================================================================
function EditorProjeto({
  projeto,
  proximaOrdem,
  onClose,
  onSaved,
  onError
}: {
  projeto: Projeto | null
  proximaOrdem: number
  onClose: () => void
  onSaved: (msg: string) => void
  onError: (msg: string) => void
}) {
  const novo = !projeto
  const [f, setF] = useState({
    nome: projeto?.nome ?? '',
    setor: projeto?.setor ?? '',
    solicitante: projeto?.solicitante ?? '',
    status: (projeto?.status ?? 'fila') as Status,
    prioridade: (projeto?.prioridade ?? 'media') as Prioridade,
    inicio: projeto?.inicio ?? '',
    previsao: projeto?.previsao ?? '',
    conclusao: projeto?.conclusao ?? '',
    descricao: projeto?.descricao ?? ''
  })
  const [etapas, setEtapas] = useState<Etapa[]>(projeto?.etapas ? projeto.etapas.map(e => ({ ...e })) : [])
  const [salvando, setSalvando] = useState(false)
  const [confirmaExclusao, setConfirmaExclusao] = useState(false)

  const set = (k: keyof typeof f, v: string) => setF(prev => ({ ...prev, [k]: v }))
  const setEtapa = (i: number, k: keyof Etapa, v: string) =>
    setEtapas(prev => prev.map((e, j) => (j === i ? { ...e, [k]: v } : e)))

  useEffect(() => {
    const esc = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  async function salvar(ev: React.FormEvent) {
    ev.preventDefault()
    setSalvando(true)
    const body = {
      nome: f.nome.trim(),
      setor: f.setor.trim(),
      solicitante: f.solicitante.trim(),
      status: f.status,
      prioridade: f.prioridade,
      inicio: f.inicio || (f.status === 'andamento' ? isoDate(today()) : null),
      previsao: f.previsao || null,
      conclusao: f.conclusao || (f.status === 'concluido' ? isoDate(today()) : null),
      descricao: f.descricao.trim(),
      etapas: etapas.filter(e => e.nome.trim()).map(e => ({ ...e, nome: e.nome.trim() })),
      ordem: projeto?.ordem ?? (f.status === 'fila' ? proximaOrdem : null),
      atualizado_em: new Date().toISOString()
    }
    const { error } = novo
      ? await supabase.from('projetos_bi').insert(body)
      : await supabase.from('projetos_bi').update(body).eq('id', projeto!.id)
    setSalvando(false)
    if (error) {
      onError('Não foi possível salvar: ' + error.message)
      return
    }
    onSaved('Projeto salvo')
  }

  async function excluir() {
    if (!confirmaExclusao) {
      setConfirmaExclusao(true)
      return
    }
    const { error } = await supabase.from('projetos_bi').delete().eq('id', projeto!.id)
    if (error) {
      onError('Não foi possível excluir: ' + error.message)
      return
    }
    onSaved('Projeto excluído')
  }

  function moverEtapa(i: number) {
    if (i === 0) return
    setEtapas(prev => {
      const n = [...prev]
      ;[n[i - 1], n[i]] = [n[i], n[i - 1]]
      return n
    })
  }

  return (
    <div className={s.modal} onClick={e => e.target === e.currentTarget && onClose()}>
      <form className={s.dialog} onSubmit={salvar}>
        <h3 className={s.dialogTitle}>{novo ? 'Novo projeto' : 'Editar projeto'}</h3>
        <div className={s.fgrid}>
          <label className={`${s.field} ${s.full}`}>
            Nome
            <input id="pNome" required value={f.nome} onChange={e => set('nome', e.target.value)} />
          </label>
          <label className={s.field}>
            Setor
            <input
              id="pSetor"
              value={f.setor}
              placeholder="Ex.: Peças, Oficina, Financeiro"
              onChange={e => set('setor', e.target.value)}
            />
          </label>
          <label className={s.field}>
            Solicitante
            <input id="pSol" value={f.solicitante} onChange={e => set('solicitante', e.target.value)} />
          </label>
          <label className={s.field}>
            Status
            <select id="pStatus" value={f.status} onChange={e => set('status', e.target.value)}>
              {(Object.keys(STATUS) as Status[]).map(k => (
                <option key={k} value={k}>
                  {STATUS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            Prioridade
            <select id="pPrio" value={f.prioridade} onChange={e => set('prioridade', e.target.value)}>
              {(Object.keys(PRIO) as Prioridade[]).map(k => (
                <option key={k} value={k}>
                  {PRIO[k]}
                </option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            Início
            <input id="pIni" type="date" value={f.inicio} onChange={e => set('inicio', e.target.value)} />
          </label>
          <label className={s.field}>
            Previsão de término
            <input id="pPrev" type="date" value={f.previsao} onChange={e => set('previsao', e.target.value)} />
          </label>
          <label className={s.field}>
            Concluído em
            <input id="pConc" type="date" value={f.conclusao} onChange={e => set('conclusao', e.target.value)} />
          </label>
          <label className={`${s.field} ${s.full}`}>
            Descrição
            <textarea id="pDesc" value={f.descricao} onChange={e => set('descricao', e.target.value)} />
          </label>
        </div>

        <div>
          <div className={s.secHead} style={{ marginBottom: 8 }}>
            <span className={s.eyebrow}>Etapas (nome · status · início · fim/previsão)</span>
            <button
              type="button"
              className={s.btn}
              onClick={() => setEtapas(prev => [...prev, { nome: '', status: 'pendente', inicio: '', fim: '' }])}
            >
              Adicionar etapa
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {etapas.length === 0 && (
              <div className={s.note}>Sem etapas. As etapas definem o percentual de andamento.</div>
            )}
            {etapas.map((e, i) => (
              <div key={i} className={s.etapaEd}>
                <input
                  id={`en${i}`}
                  className={s.etapaName}
                  aria-label="Nome da etapa"
                  placeholder="Nome da etapa"
                  value={e.nome}
                  onChange={ev => setEtapa(i, 'nome', ev.target.value)}
                />
                <select
                  id={`es${i}`}
                  aria-label="Status da etapa"
                  value={e.status}
                  onChange={ev => setEtapa(i, 'status', ev.target.value)}
                >
                  {(Object.keys(ETST) as EtapaStatus[]).map(k => (
                    <option key={k} value={k}>
                      {ETST[k]}
                    </option>
                  ))}
                </select>
                <input
                  id={`ei${i}`}
                  type="date"
                  aria-label="Início da etapa"
                  value={e.inicio}
                  onChange={ev => setEtapa(i, 'inicio', ev.target.value)}
                />
                <input
                  id={`ef${i}`}
                  type="date"
                  aria-label="Fim ou previsão da etapa"
                  value={e.fim}
                  onChange={ev => setEtapa(i, 'fim', ev.target.value)}
                />
                <span>
                  <button
                    type="button"
                    className={`${s.btn} ${s.ghost}`}
                    aria-label="Subir etapa"
                    disabled={i === 0}
                    onClick={() => moverEtapa(i)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={`${s.btn} ${s.ghost}`}
                    aria-label="Remover etapa"
                    onClick={() => setEtapas(prev => prev.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={s.dlgFoot}>
          <span>
            {!novo && (
              <button type="button" className={`${s.btn} ${s.danger}`} onClick={excluir}>
                {confirmaExclusao ? 'Confirmar exclusão' : 'Excluir projeto'}
              </button>
            )}
          </span>
          <span className={s.actions}>
            <button type="button" className={s.btn} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={`${s.btn} ${s.primary}`} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </span>
        </div>
      </form>
    </div>
  )
}

// =====================================================================
function FormSolicitacao({
  onClose,
  onSent,
  onError
}: {
  onClose: () => void
  onSent: () => void
  onError: (msg: string) => void
}) {
  const [f, setF] = useState({ titulo: '', setor: '', solicitante: '', prazo: '', prioridade: 'media', descricao: '' })
  const [enviando, setEnviando] = useState(false)
  const set = (k: keyof typeof f, v: string) => setF(prev => ({ ...prev, [k]: v }))

  useEffect(() => {
    const esc = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault()
    setEnviando(true)
    const { error } = await supabase.from('solicitacoes_bi').insert({
      titulo: f.titulo.trim(),
      setor: f.setor.trim(),
      solicitante: f.solicitante.trim(),
      prazo: f.prazo || null,
      prioridade: f.prioridade,
      descricao: f.descricao.trim()
    })
    setEnviando(false)
    if (error) {
      onError('Não foi possível enviar: ' + error.message)
      return
    }
    onSent()
  }

  return (
    <div className={s.modal} onClick={e => e.target === e.currentTarget && onClose()}>
      <form className={s.dialog} onSubmit={enviar}>
        <h3 className={s.dialogTitle}>Solicitar demanda</h3>
        <p className={s.note} style={{ margin: 0 }}>
          Descreva o painel, relatório ou análise de que seu setor precisa. O pedido aparece na lista de solicitações
          para avaliação e programação.
        </p>
        <div className={s.fgrid}>
          <label className={`${s.field} ${s.full}`}>
            O que você precisa
            <input
              id="sTit"
              required
              placeholder="Ex.: Painel de contas a receber por cliente"
              value={f.titulo}
              onChange={e => set('titulo', e.target.value)}
            />
          </label>
          <label className={s.field}>
            Setor
            <input id="sSet" required value={f.setor} onChange={e => set('setor', e.target.value)} />
          </label>
          <label className={s.field}>
            Seu nome
            <input id="sNom" required value={f.solicitante} onChange={e => set('solicitante', e.target.value)} />
          </label>
          <label className={s.field}>
            Precisa até (opcional)
            <input id="sPra" type="date" value={f.prazo} onChange={e => set('prazo', e.target.value)} />
          </label>
          <label className={s.field}>
            Urgência
            <select id="sPri" value={f.prioridade} onChange={e => set('prioridade', e.target.value)}>
              <option value="media">Normal</option>
              <option value="alta">Urgente</option>
              <option value="baixa">Pode esperar</option>
            </select>
          </label>
          <label className={`${s.field} ${s.full}`}>
            Detalhes
            <textarea
              id="sDes"
              placeholder="Quais informações, indicadores ou filtros são importantes?"
              value={f.descricao}
              onChange={e => set('descricao', e.target.value)}
            />
          </label>
        </div>
        <div className={s.dlgFoot}>
          <span />
          <span className={s.actions}>
            <button type="button" className={s.btn} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={`${s.btn} ${s.primary}`} disabled={enviando}>
              {enviando ? 'Enviando...' : 'Enviar solicitação'}
            </button>
          </span>
        </div>
      </form>
    </div>
  )
}
