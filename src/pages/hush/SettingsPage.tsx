import { ChevronLeft, Globe, Loader2, ShieldCheck } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Switch } from '@/components/ui/switch'
import { getMyVoice, setVoiceIndexable } from '@/features/echoes/services/hushApi'
import { useToast } from '@/hooks/use-toast'

export default function SettingsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const voiceQuery = useQuery({ queryKey: ['my-voice'], queryFn: getMyVoice })

  const alternarIndexacao = useMutation({
    mutationFn: (indexable: boolean) => setVoiceIndexable(voiceQuery.data!.id, indexable),
    onSuccess: (_resultado, indexable) => {
      void queryClient.invalidateQueries({ queryKey: ['my-voice'] })
      toast({
        title: indexable ? 'Preferência salva: aparecer fora do shhhh.' : 'Preferência salva: não aparecer fora do shhhh.',
        description: indexable
          ? 'Durante o beta a indexação segue desligada para todas as Voices; sua escolha vale quando ela for liberada.'
          : undefined,
      })
    },
    onError: (error: Error) => toast({ title: 'Não foi possível alterar', description: error.message, variant: 'destructive' }),
  })

  return (
    <main className="pb-28">
      <Link to="/app/profile" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><ChevronLeft className="size-4" /> Profile</Link>
      <header className="py-6">
        <p className="text-2xl font-black tracking-tight">Preferências e segurança</p>
        <p className="mt-1 text-sm text-slate-500">Controles para uma experiência mais segura e respeitosa.</p>
      </header>

      <section className="space-y-4">
        {/* Público não é a mesma coisa que indexado. A página da Voice é
            pseudônima e pode circular por link, mas entrar em buscador é uma
            escolha de quem publica — e a escolha padrão é não. */}
        <article className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"><Globe className="size-5" /></div>
              <div>
                <h2 className="font-bold">Aparecer fora do shhhh</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Guarda sua preferência para quando a indexação de Voices for liberada. A página continua acessível por link nos dois casos.
                  Echoes individuais <strong>nunca</strong> são indexados.
                </p>
                {/* Durante o beta o servidor manda noindex em toda /v/, porque
                    a meta tag da SPA depende de o rastreador executar o
                    JavaScript. Prometer indexação aqui seria mentir na tela. */}
                <p className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  Durante o beta, <strong>nenhuma</strong> Voice é indexada por buscadores, mesmo com esta opção ligada. Privacidade primeiro.
                </p>
                {!voiceQuery.isPending && !voiceQuery.data && (
                  <p className="mt-2 text-sm text-slate-500">Você ainda não tem uma Voice. Crie uma ao publicar um Echo.</p>
                )}
              </div>
            </div>
            {voiceQuery.isPending ? (
              <Loader2 className="size-5 shrink-0 animate-spin text-slate-400" />
            ) : (
              <Switch
                aria-label="Permitir que minha Voice apareça fora do shhhh"
                checked={voiceQuery.data?.indexable === true}
                disabled={!voiceQuery.data || alternarIndexacao.isPending}
                onCheckedChange={(valor) => alternarIndexacao.mutate(valor)}
              />
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"><ShieldCheck className="size-5" /></div>
            <div>
              <h2 className="font-bold">Protect My Voice</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Altera características da sua voz para dificultar o reconhecimento. Nenhuma transformação garante anonimato absoluto. Quando a proteção falha, o shhhh bloqueia a publicação e não envia o áudio original.</p>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          <h2 className="font-bold">Regras da comunidade</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Não publique dados pessoais, ameaças, perseguição, assédio direcionado, conteúdo sexual envolvendo menores, spam, impersonation maliciosa ou instruções criminosas graves. Conteúdo sensível pode ser limitado ou ocultado até revisão.</p>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          <h2 className="font-bold">Privacidade</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Sua conta não é a sua Voice. Echoes anônimos não mostram Voice, avatar, perfil nem caminho de mídia com identificação da conta. Quem recebe o link de um Echo consegue ouvi-lo sem ter conta — é assim que uma história chega a quem ainda não conhece o shhhh.</p>
        </article>
      </section>
    </main>
  )
}
