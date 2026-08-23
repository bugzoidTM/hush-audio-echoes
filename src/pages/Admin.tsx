import { Activity, AlertTriangle, Ban, Clock3, Flag, Loader2, ShieldCheck, ShieldX, TrendingUp, UserX } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { EchoPlayer } from '@/components/hush/EchoPlayer'
import {
  dismissEchoReports,
  getModerationStats,
  getAcquisitionFunnel,
  getReviewQueue,
  getWorkerStatus,
  isModerator,
  reviewEcho,
  setVoiceStatus,
  suspendAccount,
} from '@/features/moderation/services/moderationApi'
import type { ModerationDecision, ReviewItem, ReviewScope } from '@/features/moderation/types'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/use-toast'

const reasonLabels: Record<string, string> = {
  harassment: 'Assédio',
  threat: 'Ameaça',
  doxxing: 'Dados pessoais',
  sexual_content: 'Conteúdo sexual',
  minor_safety: 'Segurança de menores',
  hate: 'Ódio',
  spam: 'Spam',
  self_harm: 'Autoagressão',
  illegal_activity: 'Atividade ilegal',
  other: 'Outro',
}

const funnelLabels: Record<string, string> = {
  landing_view: 'Viu a landing',
  listen_without_account_click: 'Clicou em ouvir sem conta',
  preview_view: 'Abriu a prévia',
  preview_play: 'Tocou na prévia',
  preview_next: 'Pediu outro Echo',
  preview_gate_reached: 'Chegou ao limite da prévia',
  shared_echo_view: 'Abriu Echo compartilhado',
  shared_echo_play: 'Tocou Echo compartilhado',
  signup_view: 'Abriu o cadastro',
  signup_completed: 'Criou conta',
  onboarding_completed: 'Concluiu onboarding',
  first_discovery_play: 'Primeiro play no Discovery',
  first_reaction: 'Primeira reação',
  first_follow: 'Primeiro follow',
  first_publish: 'Primeiro Echo publicado',
}

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: 'Em análise', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
  review_required: { label: 'Revisão humana', className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' },
  limited: { label: 'Alcance limitado', className: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200' },
  approved: { label: 'Aprovado', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
  rejected: { label: 'Rejeitado', className: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200' },
}

export default function Admin() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [scope, setScope] = useState<ReviewScope>('all')

  // O papel de moderação é verificado no banco (is_moderator), não pela tela: a
  // rota apenas deixa de renderizar. Toda RPC do painel refaz a checagem.
  const moderatorQuery = useQuery({ queryKey: ['is-moderator'], queryFn: isModerator, enabled: Boolean(user) })
  const statsQuery = useQuery({ queryKey: ['moderation-stats'], queryFn: getModerationStats, enabled: moderatorQuery.data === true, refetchInterval: 60_000 })
  const queueQuery = useQuery({ queryKey: ['review-queue', scope], queryFn: () => getReviewQueue(scope), enabled: moderatorQuery.data === true })
  // Worker morto é o pior modo de falha: a fila não cresce por conteúdo ruim,
  // ela cresce porque ninguém está processando. Sem isto na tela, um dia de
  // Echoes invisíveis passaria por "está calmo hoje".
  const workersQuery = useQuery({ queryKey: ['worker-status'], queryFn: getWorkerStatus, enabled: moderatorQuery.data === true, refetchInterval: 60_000 })
  const funilQuery = useQuery({ queryKey: ['acquisition-funnel'], queryFn: () => getAcquisitionFunnel(7), enabled: moderatorQuery.data === true })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['review-queue'] })
    void queryClient.invalidateQueries({ queryKey: ['moderation-stats'] })
  }

  const decide = useMutation({
    mutationFn: ({ echoId, decision, note }: { echoId: string; decision: ModerationDecision; note?: string }) => reviewEcho(echoId, decision, note),
    onSuccess: (_result, variables) => {
      toast({ title: variables.decision === 'approved' ? 'Echo liberado.' : variables.decision === 'limited' ? 'Alcance limitado.' : 'Echo retirado do ar.' })
      refresh()
    },
    onError: (error: Error) => toast({ title: 'Não foi possível decidir', description: error.message, variant: 'destructive' }),
  })

  const archiveReports = useMutation({
    mutationFn: ({ echoId, note }: { echoId: string; note?: string }) => dismissEchoReports(echoId, note),
    onSuccess: () => { toast({ title: 'Denúncias arquivadas.' }); refresh() },
    onError: (error: Error) => toast({ title: 'Não foi possível arquivar', description: error.message, variant: 'destructive' }),
  })

  const voiceStatus = useMutation({
    mutationFn: ({ voiceId, status }: { voiceId: string; status: 'active' | 'suspended' }) => setVoiceStatus(voiceId, status),
    onSuccess: (_result, variables) => {
      toast({ title: variables.status === 'suspended' ? 'Voice suspensa.' : 'Voice reativada.', description: variables.status === 'suspended' ? 'Os Echoes dela saem do Discovery imediatamente.' : undefined })
      refresh()
    },
    onError: (error: Error) => toast({ title: 'Não foi possível alterar a Voice', description: error.message, variant: 'destructive' }),
  })

  const accountSuspension = useMutation({
    mutationFn: ({ userId, suspended, note }: { userId: string; suspended: boolean; note?: string }) => suspendAccount(userId, suspended, note),
    onSuccess: (result, variables) => {
      toast({
        title: variables.suspended ? 'Conta suspensa.' : 'Conta reativada.',
        description: variables.suspended ? `${result.voices_afetadas} Voice(s) suspensa(s) e ${result.echoes_afetados} Echo(es) tirado(s) do ar.` : 'O conteúdo volta pela fila, um Echo por vez.',
      })
      refresh()
    },
    onError: (error: Error) => toast({ title: 'Não foi possível alterar a conta', description: error.message, variant: 'destructive' }),
  })

  if (loading || moderatorQuery.isPending) {
    return <div className="grid min-h-dvh place-items-center"><Loader2 className="size-7 animate-spin text-indigo-600" /></div>
  }

  if (!user) {
    navigate('/auth', { replace: true })
    return null
  }

  if (moderatorQuery.data !== true) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="max-w-md">
          <ShieldX className="mx-auto size-10 text-rose-500" />
          <h1 className="mt-4 text-xl font-bold">Painel restrito</h1>
          <p className="mt-2 text-sm text-slate-500">Esta área é de Trust &amp; Safety. É preciso papel de moderação nesta conta.</p>
          <Button className="mt-5" onClick={() => navigate('/app/echoes')}>Voltar aos Echoes</Button>
        </div>
      </main>
    )
  }

  const stats = statsQuery.data
  const items = queueQuery.data ?? []

  return (
    <main className="mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">Trust &amp; Safety</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white">Fila de moderação</h1>
        <p className="mt-2 text-sm text-slate-500">
          Nenhum Echo é publicado sem análise. O que a transcrição automática não libera para no seu colo.
        </p>
      </header>

      {stats && (
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Situação da moderação">
          <StatTile label="Em análise" value={stats.pending} icon={Clock3} />
          <StatTile label="Presos há 30+ min" value={stats.stuck_pending} icon={AlertTriangle} alert={stats.stuck_pending > 0} />
          <StatTile label="Revisão humana" value={stats.review_required} icon={ShieldCheck} alert={stats.review_required > 0} />
          <StatTile label="Denúncias abertas" value={stats.open_reports} icon={Flag} alert={stats.open_reports > 0} />
          <StatTile label="Alcance limitado" value={stats.limited} icon={ShieldX} />
          <StatTile label="No ar" value={stats.approved_active} icon={ShieldCheck} />
        </section>
      )}

      {(workersQuery.data ?? []).some((worker) => worker.parado) && (
        <p className="mb-6 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-100">
          <AlertTriangle className="mr-2 inline size-4" />
          <strong>Worker parado.</strong>{' '}
          {(workersQuery.data ?? []).filter((worker) => worker.parado).map((worker) => `${worker.name} (${worker.minutos_desde >= 999999 ? 'nunca rodou' : `${worker.minutos_desde} min`})`).join(', ')}.
          {' '}Enquanto isso, nenhum Echo novo sai de "em análise". Conferir o cron em <code>/usr/local/lib/shhhh</code> e o <code>whisper-stt</code>.
        </p>
      )}

      {workersQuery.data && workersQuery.data.length > 0 && (
        <section className="mb-6 flex flex-wrap gap-2" aria-label="Workers de manutenção">
          {workersQuery.data.map((worker) => (
            <span
              key={worker.name}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${worker.parado ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'}`}
            >
              <Activity className="size-3.5" />
              {worker.name}: {worker.parado ? 'parado' : `há ${worker.minutos_desde} min`}
            </span>
          ))}
        </section>
      )}

      {stats && stats.stuck_pending > 0 && (
        <p className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
          <AlertTriangle className="mr-2 inline size-4" />
          {stats.stuck_pending} Echo(s) parado(s) em análise há mais de 30 minutos. Isso costuma ser worker de moderação parado — confira o <code>whisper-stt</code> e o cron <code>moderate-pending-echoes.sh</code>.
        </p>
      )}

      {/* O funil de aquisição fica aqui porque é a pergunta que mais importa
          agora: das pessoas que ouvem sem conta, quantas criam uma? Sem isto,
          500 visitantes na prévia seriam invisíveis. */}
      {funilQuery.data && funilQuery.data.length > 0 && (
        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950" aria-label="Funil de aquisição">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="size-4 text-indigo-600 dark:text-indigo-300" />
            <h2 className="font-bold text-slate-950 dark:text-white">Funil de aquisição · 7 dias</h2>
          </div>
          <div className="space-y-1.5">
            {funilQuery.data.map((etapa) => {
              const maior = Math.max(...funilQuery.data.map((item) => item.sessoes), 1)
              return (
                <div key={etapa.event_type} className="flex items-center gap-3 text-sm">
                  <span className="w-56 shrink-0 truncate text-slate-600 dark:text-slate-300">{funnelLabels[etapa.event_type] ?? etapa.event_type}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(etapa.sessoes / maior) * 100}%` }} />
                  </div>
                  <span className="w-20 shrink-0 text-right font-semibold tabular-nums text-slate-950 dark:text-white">
                    {etapa.sessoes}
                    <span className="ml-1 text-xs font-normal text-slate-400">sess.</span>
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <Tabs value={scope} onValueChange={(value) => setScope(value as ReviewScope)} className="mb-5">
        <TabsList>
          <TabsTrigger value="all">Tudo</TabsTrigger>
          <TabsTrigger value="moderation">Moderação</TabsTrigger>
          <TabsTrigger value="reports">Denúncias</TabsTrigger>
        </TabsList>
      </Tabs>

      {queueQuery.isPending ? (
        <div className="grid place-items-center py-16"><Loader2 className="size-6 animate-spin text-indigo-600" /></div>
      ) : queueQuery.isError ? (
        <p className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-100">
          {(queueQuery.error as Error).message}
        </p>
      ) : items.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
          <div>
            <ShieldCheck className="mx-auto size-10 text-emerald-500" />
            <p className="mt-3 font-bold text-slate-900 dark:text-slate-100">Fila vazia</p>
            <p className="mt-1 text-sm text-slate-500">Nada esperando decisão humana neste momento.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {items.map((item) => (
            <ReviewCard
              key={item.id}
              item={item}
              busy={decide.isPending || voiceStatus.isPending || accountSuspension.isPending || archiveReports.isPending}
              onDecide={(decision, note) => decide.mutate({ echoId: item.id, decision, note })}
              onArchiveReports={(note) => archiveReports.mutate({ echoId: item.id, note })}
              onVoiceStatus={(status) => item.voice_id && voiceStatus.mutate({ voiceId: item.voice_id, status })}
              onAccountSuspension={(suspended, note) => accountSuspension.mutate({ userId: item.owner_user_id, suspended, note })}
            />
          ))}
        </div>
      )}
    </main>
  )
}

function StatTile({ label, value, icon: Icon, alert = false }: { label: string; value: number; icon: typeof Clock3; alert?: boolean }) {
  return (
    <Card className={alert ? 'border-amber-300 dark:border-amber-900' : undefined}>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className={`size-5 ${alert ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`} />
        <div className="min-w-0">
          <p className="text-xl font-black leading-none text-slate-950 dark:text-white">{value}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function ReviewCard({
  item,
  busy,
  onDecide,
  onArchiveReports,
  onVoiceStatus,
  onAccountSuspension,
}: {
  item: ReviewItem
  busy: boolean
  onDecide: (decision: ModerationDecision, note?: string) => void
  onArchiveReports: (note?: string) => void
  onVoiceStatus: (status: 'active' | 'suspended') => void
  onAccountSuspension: (suspended: boolean, note?: string) => void
}) {
  const [note, setNote] = useState('')
  const [showClientText, setShowClientText] = useState(false)
  const status = statusLabels[item.moderation_status] ?? { label: item.moderation_status, className: 'bg-slate-100 text-slate-700' }
  const suspended = item.voice_status === 'suspended'

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
          {item.open_reports > 0 && (
            <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-200">
              {item.open_reports} denúncia(s): {item.report_reasons.map((reason) => reasonLabels[reason] ?? reason).join(', ')}
            </span>
          )}
          {item.category_name && <span className="text-xs text-slate-500">{item.category_name}</span>}
          <span className="text-xs text-slate-400">{new Date(item.published_at).toLocaleString('pt-BR')}</span>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">{item.title ?? 'Sem chamada'}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {item.identity_mode === 'anonymous'
              ? 'Publicado como anônimo'
              : `${item.voice_display_name ?? 'Voice'} ${item.voice_handle ?? ''}${suspended ? ' · suspensa' : ''}`}
          </p>
          {item.description && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.description}</p>}
        </div>

        <EchoPlayer echoId={item.id} audioUrl={item.audio_url} duration={item.duration} active={false} />

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Transcrição do servidor</p>
          <p className="mt-1 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">
            {item.transcription ?? <span className="text-slate-400">Sem transcrição — o whisper falhou {item.moderation_attempts}x. {item.moderation_note}</span>}
          </p>
          {/* O texto do cliente fica escondido e rotulado: ele não vale como
              prova, mas ajuda a ver quando alguém tentou enganar a moderação. */}
          {item.client_transcription && (
            <Button variant="link" size="sm" className="h-auto p-0 pt-2 text-xs text-slate-500" onClick={() => setShowClientText((visible) => !visible)}>
              {showClientText ? 'Ocultar texto enviado pelo cliente' : 'Ver texto enviado pelo cliente (não confiável)'}
            </Button>
          )}
          {showClientText && item.client_transcription && (
            <p className="mt-2 rounded-xl border border-dashed border-amber-400 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              {item.client_transcription}
            </p>
          )}
        </div>

        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Nota da decisão (fica no registro do Echo e na denúncia)"
          className="min-h-[64px]"
          aria-label="Nota da decisão"
        />

        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => onDecide('approved', note)} className="rounded-xl bg-emerald-600 hover:bg-emerald-500">
            <ShieldCheck className="mr-2 size-4" /> Aprovar
          </Button>
          <Button disabled={busy} variant="outline" className="rounded-xl" onClick={() => onDecide('limited', note)}>
            Limitar alcance
          </Button>
          <Button disabled={busy} variant="destructive" className="rounded-xl" onClick={() => onDecide('rejected', note)}>
            <Ban className="mr-2 size-4" /> Rejeitar
          </Button>
          {item.open_reports > 0 && (
            <Button disabled={busy} variant="ghost" className="rounded-xl" onClick={() => onArchiveReports(note)}>
              <Flag className="mr-2 size-4" /> Arquivar denúncias
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          {item.voice_id && (
            <Button disabled={busy} variant="outline" size="sm" className="rounded-xl" onClick={() => onVoiceStatus(suspended ? 'active' : 'suspended')}>
              <UserX className="mr-2 size-4" /> {suspended ? 'Reativar Voice' : 'Suspender Voice'}
            </Button>
          )}
          <Button
            disabled={busy}
            variant="outline"
            size="sm"
            className="rounded-xl border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300"
            onClick={() => {
              if (window.confirm('Suspender esta conta bloqueia o login e tira todo o conteúdo dela do ar. Confirmar?')) {
                onAccountSuspension(true, note)
              }
            }}
          >
            <Ban className="mr-2 size-4" /> Suspender conta
          </Button>
          <Button disabled={busy} variant="ghost" size="sm" className="rounded-xl text-slate-500" onClick={() => onAccountSuspension(false, note)}>
            Reativar conta
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
