import { AlertTriangle, Clock3, Flag, MessageCircle, Share2, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { VoiceAvatar } from '@/components/hush/VoiceAvatar'
import { EchoPlayer } from '@/components/hush/EchoPlayer'
import { trackEchoEvent } from '@/features/analytics/services/analytics'
import { useTimeLeft } from '@/features/echoes/useTimeLeft'
import { createReport, setReaction } from '@/features/echoes/services/hushApi'
import type { EchoReactionType, PublicEcho } from '@/features/echoes/types'
import { useToast } from '@/hooks/use-toast'

interface EchoCardProps {
  echo: PublicEcho
  active: boolean
  onAudioStarted: () => void
  onReply: (echo: PublicEcho) => void
  onFollow: (echo: PublicEcho) => void
}

const reactions: Array<{ type: EchoReactionType; label: string; shortLabel: string }> = [
  { type: 'me_too', label: 'Eu também', shortLabel: 'Eu também' },
  { type: 'with_you', label: 'Estou com você', shortLabel: 'Com você' },
  { type: 'wow', label: 'Caramba', shortLabel: 'Caramba' },
  { type: 'helped', label: 'Me ajudou', shortLabel: 'Me ajudou' },
]

export function EchoCard({ echo, active, onAudioStarted, onReply, onFollow }: EchoCardProps) {
  const { toast } = useToast()
  const [selectedReaction, setSelectedReaction] = useState<EchoReactionType | null>(null)
  const [showTranscript, setShowTranscript] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportReason, setReportReason] = useState<'harassment' | 'threat' | 'doxxing' | 'sexual_content' | 'minor_safety' | 'hate' | 'spam' | 'self_harm' | 'illegal_activity' | 'other'>('harassment')
  const expiresLabel = useTimeLeft(echo.expires_at)

  const react = async (reaction: EchoReactionType) => {
    setSelectedReaction(reaction)
    try {
      await setReaction(echo.id, reaction)
      void trackEchoEvent(echo.id, 'reaction')
    } catch (error) {
      setSelectedReaction(null)
      toast({ title: 'Não foi possível reagir', description: error instanceof Error ? error.message : 'Tente novamente.', variant: 'destructive' })
    }
  }

  const share = async () => {
    const url = `${window.location.origin}/e/${echo.id}`
    try {
      if (navigator.share) await navigator.share({ title: echo.title ?? 'Um Echo no shhhh', url })
      else await navigator.clipboard.writeText(url)
      void trackEchoEvent(echo.id, 'share')
      toast({ title: 'Link pronto para compartilhar.' })
    } catch {
      // O cancelamento do compartilhamento não é erro para o usuário.
    }
  }

  const submitReport = async () => {
    try {
      await createReport(echo.id, reportReason)
      void trackEchoEvent(echo.id, 'report')
      setShowReport(false)
      toast({ title: 'Denúncia enviada', description: 'Nossa equipe avaliará este Echo.' })
    } catch (error) {
      toast({ title: 'Não foi possível enviar a denúncia', description: error instanceof Error ? error.message : 'Tente novamente.', variant: 'destructive' })
    }
  }

  return (
    <article className="relative flex min-h-[calc(100dvh-8rem)] snap-start flex-col justify-center px-1 py-8 sm:px-4" aria-label={`Echo: ${echo.title ?? 'sem chamada'}`}>
      <div className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white p-5 shadow-xl shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-950 sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {echo.voice_handle ? (
              <Link to={`/v/${encodeURIComponent(echo.voice_handle.replace('@', ''))}`} className="flex min-w-0 items-center gap-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                <VoiceAvatar seed={echo.avatar_seed} label={echo.public_identity} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-50">{echo.public_identity}</p>
                  <p className="truncate text-xs text-slate-500">{echo.voice_handle}</p>
                </div>
              </Link>
            ) : (
              <>
                <div className="grid size-10 place-items-center rounded-2xl bg-slate-900 text-lg" aria-hidden="true">◌</div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-50">Anônimo</p>
                  <p className="text-xs text-slate-500">Sem vínculo público</p>
                </div>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1 text-xs font-medium text-slate-500">
            <Clock3 className="size-3.5" /> {expiresLabel}
          </div>
        </div>

        <div className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">{echo.category_name ?? 'História'}</p>
          <h2 className="text-balance text-2xl font-bold leading-tight text-slate-950 dark:text-white sm:text-3xl">{echo.title ?? 'Uma história para ouvir.'}</h2>
          {echo.description && <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{echo.description}</p>}
          {echo.voice_protection_enabled && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-200">
              <AlertTriangle className="size-3.5" /> Voz protegida · identificação pode continuar possível
            </p>
          )}
        </div>

        <EchoPlayer echoId={echo.id} audioUrl={echo.audio_url} duration={echo.duration} active={active} onStarted={onAudioStarted} />

        <div className="mt-6 flex flex-wrap gap-2" aria-label="Reações">
          {reactions.map((reaction) => {
            const count = echo.reaction_counts[reaction.type] ?? 0
            const selected = selectedReaction === reaction.type
            return (
              <Button
                key={reaction.type}
                size="sm"
                variant={selected ? 'default' : 'outline'}
                onClick={() => void react(reaction.type)}
                className="rounded-full border-slate-200 px-3 dark:border-slate-700"
              >
                {reaction.shortLabel}{count > 0 ? ` · ${formatCount(count)}` : ''}
              </Button>
            )
          })}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="rounded-xl text-slate-600 dark:text-slate-300" onClick={() => onReply(echo)}>
              <MessageCircle className="mr-2 size-4" /> Responder{echo.reply_count ? ` · ${echo.reply_count}` : ''}
            </Button>
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => void share()} aria-label="Compartilhar Echo"><Share2 className="size-4" /></Button>
          </div>
          <div className="flex gap-1">
            {echo.voice_handle && <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => onFollow(echo)} aria-label="Seguir Voice"><UserPlus className="size-4" /></Button>}
            <Button variant="ghost" size="icon" className="rounded-xl text-slate-500" onClick={() => setShowReport(true)} aria-label="Denunciar Echo"><Flag className="size-4" /></Button>
          </div>
        </div>

        {/* Transcrição é a do servidor, feita a partir do áudio publicado. Antes
            este bloco mostrava echo.description: descrição não é transcrição, e
            a interface tratava as duas como a mesma coisa. */}
        {echo.transcription && (
          <div className="mt-3">
            <Button variant="link" size="sm" className="h-auto p-0 text-xs text-slate-500" onClick={() => setShowTranscript((visible) => !visible)}>
              {showTranscript ? 'Ocultar transcrição' : 'Mostrar transcrição'}
            </Button>
            {showTranscript && (
              <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                {echo.transcription}
              </p>
            )}
          </div>
        )}
      </div>

      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent>
          <DialogHeader><DialogTitle>Denunciar Echo</DialogTitle><DialogDescription>Escolha o motivo. Denúncias ajudam a manter o shhhh seguro.</DialogDescription></DialogHeader>
          <select value={reportReason} onChange={(event) => setReportReason(event.target.value as typeof reportReason)} aria-label="Motivo da denúncia" className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="harassment">Assédio</option><option value="threat">Ameaça</option><option value="doxxing">Dados pessoais</option><option value="sexual_content">Conteúdo sexual</option><option value="minor_safety">Segurança de menores</option><option value="hate">Ódio</option><option value="spam">Spam</option><option value="self_harm">Autoagressão</option><option value="illegal_activity">Atividade ilegal</option><option value="other">Outro</option></select>
          <Button onClick={() => void submitReport()} variant="destructive">Enviar denúncia</Button>
        </DialogContent>
      </Dialog>
    </article>
  )
}

function formatCount(count: number): string {
  return count >= 1000 ? `${(count / 1000).toFixed(1).replace('.0', '')} mil` : String(count)
}

