import { Loader2, Mic, RotateCcw, ShieldCheck, Square, Volume2, WandSparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { createVoice, generateEchoHook, getCategories, getMyVoice, publishEcho, transcribeFinalAudio } from '@/features/echoes/services/hushApi'
import { canPublishWithProtection, isDiscoveryDurationValid } from '@/features/echoes/services/discoveryPolicy'
import { voiceProtectionProvider } from '@/features/echoes/services/voiceProtection'
import type { EchoCategory, EchoExpiration, IdentityMode, VoiceProtectionPreset } from '@/features/echoes/types'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useToast } from '@/hooks/use-toast'

interface CreateEchoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  replyToId?: string | null
}

const expirationOptions: Array<{ value: EchoExpiration; label: string }> = [
  { value: '1h', label: '1 hora' },
  { value: '6h', label: '6 horas' },
  { value: '24h', label: '24 horas' },
  { value: '7d', label: '7 dias' },
  { value: 'permanent', label: 'Permanente' },
]

const protectionLabels: Record<VoiceProtectionPreset, { title: string; description: string }> = {
  natural: { title: 'Natural', description: 'Discreta e preserva mais do seu timbre.' },
  shadow: { title: 'Shadow', description: 'Altera mais as características vocais.' },
  deep: { title: 'Deep', description: 'Variação mais grave.' },
  soft: { title: 'Soft', description: 'Variação suave.' },
}

export function CreateEchoModal({ open, onOpenChange, replyToId }: CreateEchoModalProps) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const recorder = useAudioRecorder()
  const [categories, setCategories] = useState<EchoCategory[]>([])
  const [identityMode, setIdentityMode] = useState<IdentityMode>('anonymous')
  const [voice, setVoice] = useState<Awaited<ReturnType<typeof getMyVoice>>>(null)
  const [protectVoice, setProtectVoice] = useState(false)
  const [preset, setPreset] = useState<VoiceProtectionPreset>('natural')
  const [protectedAudio, setProtectedAudio] = useState<Awaited<ReturnType<typeof voiceProtectionProvider.protectAudio>> | null>(null)
  const [processing, setProcessing] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [expiration, setExpiration] = useState<EchoExpiration>('24h')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [transcription, setTranscription] = useState<string | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const [showVoiceCreator, setShowVoiceCreator] = useState(false)
  const [voiceHandle, setVoiceHandle] = useState('')
  const [voiceDisplayName, setVoiceDisplayName] = useState('')

  useEffect(() => {
    if (!open) return
    void Promise.all([getCategories(), getMyVoice()])
      .then(([availableCategories, currentVoice]) => {
        setCategories(availableCategories)
        setVoice(currentVoice)
        if (availableCategories[0]) setCategoryId((current) => current || availableCategories[0].id)
      })
      .catch((error: unknown) => toast({ title: 'Não foi possível preparar a publicação', description: error instanceof Error ? error.message : 'Tente novamente.', variant: 'destructive' }))
  }, [open, toast])

  useEffect(() => {
    setProtectedAudio(null)
  }, [recorder.recordedBlob, preset])

  const durationIsValid = isDiscoveryDurationValid(recorder.duration)
  const previewUrl = protectVoice ? protectedAudio?.previewUrl : recorder.recordedUrl
  const canPublish = Boolean(
    recorder.recordedBlob &&
    durationIsValid &&
    categoryId &&
    (!protectVoice || canPublishWithProtection(protectedAudio)) &&
    (identityMode === 'anonymous' || voice),
  )

  const recordingPrompt = useMemo(() => replyToId ? 'Sua resposta será publicada como um novo Echo.' : 'Conte algo que você nunca diria em outro lugar.', [replyToId])

  const protect = async () => {
    if (!recorder.recordedBlob) return
    setProcessing(true)
    setProtectedAudio(null)
    try {
      const result = await voiceProtectionProvider.protectAudio(recorder.recordedBlob, preset)
      setProtectedAudio(result)
      toast({ title: 'Preview protegido pronto', description: 'O áudio original continuará somente no seu dispositivo.' })
    } catch (error) {
      toast({
        title: 'Não foi possível proteger sua voz',
        description: 'O áudio original não será enviado enquanto a proteção estiver ativada.',
        variant: 'destructive',
      })
    } finally {
      setProcessing(false)
    }
  }

  const transcribe = async () => {
    const audio = protectVoice ? protectedAudio?.blob : recorder.recordedBlob
    if (!audio) {
      toast({ title: 'Gere o preview protegido antes de transcrever.', variant: 'destructive' })
      return
    }
    setTranscribing(true)
    try {
      const text = await transcribeFinalAudio(audio)
      setTranscription(text)
      if (!title.trim() && text) setTitle(await generateEchoHook(text))
      toast({ title: 'Transcrição pronta', description: 'Você pode revisar o texto e a chamada antes de publicar.' })
    } catch (error) {
      toast({ title: 'Transcrição indisponível', description: error instanceof Error ? error.message : 'Você ainda pode publicar sem transcrição.', variant: 'destructive' })
    } finally {
      setTranscribing(false)
    }
  }

  const createVoiceIfNeeded = async () => {
    if (!voiceHandle.trim() || !voiceDisplayName.trim()) {
      toast({ title: 'Defina o nome e o @ da sua Voice.', variant: 'destructive' })
      return
    }
    try {
      await createVoice({ handle: voiceHandle, displayName: voiceDisplayName })
      setVoice(await getMyVoice())
      setShowVoiceCreator(false)
      toast({ title: 'Sua Voice foi criada.' })
    } catch (error) {
      toast({ title: 'Não foi possível criar a Voice', description: error instanceof Error ? error.message : 'Tente outro @.', variant: 'destructive' })
    }
  }

  const submit = async () => {
    if (!recorder.recordedBlob || !canPublish) return
    setPublishing(true)
    try {
      const result = await publishEcho({
        audio: recorder.recordedBlob,
        duration: recorder.duration,
        identityMode,
        voiceId: identityMode === 'voice' ? voice?.id ?? null : null,
        categoryId,
        title,
        description,
        expiration,
        transcription,
        voiceProtectionEnabled: protectVoice,
        voiceProtectionPreset: preset,
        protectedAudio,
        replyToId: replyToId ?? null,
      })
      toast({
        title: result.moderation_status === 'approved' ? 'Echo publicado.' : 'Echo enviado para revisão.',
        description: identityMode === 'anonymous' ? 'Sua identidade pública não foi vinculada a este Echo.' : undefined,
      })
      resetAndClose()
      navigate(`/e/${result.id}`)
    } catch (error) {
      toast({ title: 'Não foi possível publicar', description: error instanceof Error ? error.message : 'Tente novamente.', variant: 'destructive' })
    } finally {
      setPublishing(false)
    }
  }

  const resetAndClose = () => {
    recorder.resetRecording()
    setProtectedAudio(null)
    setTitle('')
    setDescription('')
    setTranscription(null)
    setProtectVoice(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : resetAndClose())}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">{replyToId ? 'Responder com voz' : 'Criar Echo'}</DialogTitle>
          <DialogDescription>{recordingPrompt}</DialogDescription>
        </DialogHeader>

        {!recorder.recordedBlob ? (
          <section className="grid min-h-72 place-items-center rounded-3xl border border-dashed border-indigo-200 bg-indigo-50/60 p-6 text-center dark:border-indigo-900 dark:bg-indigo-950/30">
            <div>
              <div className={`mx-auto mb-5 grid size-20 place-items-center rounded-full ${recorder.isRecording ? 'animate-pulse bg-rose-500' : 'bg-indigo-600'} text-white shadow-lg`}>
                {recorder.isRecording ? <Square className="size-7 fill-current" /> : <Mic className="size-8" />}
              </div>
              <p className="font-semibold text-slate-900 dark:text-white">{recorder.isRecording ? 'Gravando seu Echo…' : 'Pronto para contar?'}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Entre 5 e 60 segundos para o Discovery.</p>
              <Button className="mt-6 rounded-2xl px-6" size="lg" onClick={recorder.isRecording ? recorder.stopRecording : () => void recorder.startRecording()}>
                {recorder.isRecording ? 'Parar gravação' : 'Começar a gravar'}
              </Button>
            </div>
          </section>
        ) : (
          <div className="space-y-6">
            <section className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <div><p className="font-semibold">Seu preview · {recorder.duration}s</p><p className="text-sm text-slate-500">{durationIsValid ? 'Duração ideal para Discovery.' : 'A gravação deve ter entre 5 e 60 segundos.'}</p></div>
                <Button variant="outline" className="rounded-xl" onClick={recorder.resetRecording}><RotateCcw className="mr-2 size-4" /> Gravar de novo</Button>
              </div>
              {previewUrl && <audio className="mt-4 w-full" controls src={previewUrl} />}
            </section>

            <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-center justify-between gap-4">
                <div><Label htmlFor="protect-voice" className="text-base font-semibold">Protect My Voice</Label><p className="mt-1 text-sm text-slate-500">Altera características da sua voz para dificultar o reconhecimento. Nenhuma transformação garante anonimato absoluto.</p></div>
                <Switch id="protect-voice" checked={protectVoice} onCheckedChange={setProtectVoice} />
              </div>
              {protectVoice && (
                <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <RadioGroup value={preset} onValueChange={(value) => setPreset(value as VoiceProtectionPreset)} className="grid gap-2 sm:grid-cols-2">
                    {(Object.keys(protectionLabels) as VoiceProtectionPreset[]).map((key) => <Label key={key} htmlFor={`preset-${key}`} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-950/30"><RadioGroupItem value={key} id={`preset-${key}`} /><span><span className="font-semibold">{protectionLabels[key].title}</span><span className="mt-0.5 block text-xs font-normal text-slate-500">{protectionLabels[key].description}</span></span></Label>)}
                  </RadioGroup>
                  <Button variant="outline" className="rounded-xl" onClick={() => void protect()} disabled={processing}>{processing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ShieldCheck className="mr-2 size-4" />}{protectedAudio ? 'Gerar novo preview' : 'Gerar preview protegido'}</Button>
                </div>
              )}
            </section>

            <section className="space-y-3">
              <Label>Como você quer aparecer?</Label>
              <RadioGroup value={identityMode} onValueChange={(value) => setIdentityMode(value as IdentityMode)} className="grid gap-2 sm:grid-cols-2">
                <Label htmlFor="anonymous" className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-950/30"><RadioGroupItem id="anonymous" value="anonymous" /><span><span className="font-semibold">Anônimo</span><span className="mt-1 block text-xs font-normal text-slate-500">Sem Voice, perfil ou dados de conta no Echo.</span></span></Label>
                <Label htmlFor="voice" className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-950/30"><RadioGroupItem id="voice" value="voice" /><span><span className="font-semibold">Minha Voice</span><span className="mt-1 block text-xs font-normal text-slate-500">{voice ? `${voice.display_name} · ${voice.handle}` : 'Crie uma Voice pseudônima.'}</span></span></Label>
              </RadioGroup>
              {identityMode === 'voice' && !voice && <Button variant="outline" onClick={() => setShowVoiceCreator(true)}>Criar minha Voice</Button>}
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="category">Categoria</Label><Select value={categoryId} onValueChange={setCategoryId}><SelectTrigger id="category"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="expiration">Expiração</Label><Select value={expiration} onValueChange={(value) => setExpiration(value as EchoExpiration)}><SelectTrigger id="expiration"><SelectValue /></SelectTrigger><SelectContent>{expirationOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">Transcrição</p><p className="text-sm text-slate-500">Acessibilidade, busca e moderação. Opcional.</p></div><Button type="button" variant="outline" size="sm" className="rounded-xl" disabled={transcribing || (protectVoice && !protectedAudio)} onClick={() => void transcribe()}>{transcribing ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <WandSparkles className="mr-2 size-3.5" />}{transcription ? 'Transcrever novamente' : 'Gerar transcrição'}</Button></div>{transcription && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">{transcription}</p>}</div>
            <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="title">Chamada curta</Label><Button type="button" variant="ghost" size="sm" className="h-auto p-0 text-xs" onClick={() => setTitle((current) => current || (transcription ? transcription.slice(0, 140) : 'Uma história que eu nunca contei.'))}><WandSparkles className="mr-1 size-3" /> Sugerir chamada</Button></div><Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={140} placeholder="O que faz alguém querer ouvir?" /></div>
            <div className="space-y-2"><Label htmlFor="description">Transcrição ou contexto opcional</Label><Textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="Ajuda pessoas a encontrar e entender seu Echo." /></div>

            <Button className="w-full rounded-2xl" size="lg" disabled={!canPublish || publishing} onClick={() => void submit()}>{publishing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Volume2 className="mr-2 size-4" />}Publicar Echo</Button>
          </div>
        )}
      </DialogContent>

      <Dialog open={showVoiceCreator} onOpenChange={setShowVoiceCreator}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Crie sua Voice</DialogTitle><DialogDescription>Uma identidade pública pseudônima. Você pode editar depois.</DialogDescription></DialogHeader><div className="space-y-3"><div className="space-y-1"><Label htmlFor="voice-name">Nome</Label><Input id="voice-name" value={voiceDisplayName} onChange={(event) => setVoiceDisplayName(event.target.value)} placeholder="Voz 82AF" /></div><div className="space-y-1"><Label htmlFor="voice-handle">@</Label><Input id="voice-handle" value={voiceHandle} onChange={(event) => setVoiceHandle(event.target.value.replace(/^@/, ''))} placeholder="noiteazul" /></div><Button className="w-full" onClick={() => void createVoiceIfNeeded()}>Criar Voice</Button></div></DialogContent>
      </Dialog>
    </Dialog>
  )
}
