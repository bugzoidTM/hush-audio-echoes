import { ChevronLeft, Download, Globe, Loader2, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { deleteMyAccount, exportMyData, getMyVoice, setVoiceIndexable } from '@/features/echoes/services/hushApi'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/use-toast'

export default function SettingsPage() {
  const { toast } = useToast()
  const { signOut } = useAuth()
  const queryClient = useQueryClient()
  const voiceQuery = useQuery({ queryKey: ['my-voice'], queryFn: getMyVoice })
  const [exclusaoAberta, setExclusaoAberta] = useState(false)
  const [senha, setSenha] = useState('')

  // Portabilidade: o arquivo é montado no navegador a partir da resposta da
  // RPC. Nada é gravado no servidor, então não há cópia da exportação para
  // vazar depois.
  const baixarDados = useMutation({
    mutationFn: exportMyData,
    onSuccess: (dados) => {
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `shhhh-meus-dados-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      toast({ title: 'Seus dados foram baixados.' })
    },
    onError: (erro: Error) => toast({ title: 'Não foi possível exportar', description: erro.message, variant: 'destructive' }),
  })

  const excluirConta = useMutation({
    mutationFn: () => deleteMyAccount(senha),
    onSuccess: async () => {
      toast({ title: 'Sua conta foi excluída.', description: 'Seus Echoes e suas Voices foram removidos.' })
      await signOut()
    },
    onError: (erro: Error) => toast({ title: 'Não foi possível excluir', description: erro.message, variant: 'destructive' }),
  })

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

        {/* Direitos do titular (LGPD, art. 18). Um produto que tem porta de
            entrada precisa ter porta de saída, e ela precisa estar visível. */}
        <article className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"><Download className="size-5" /></div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold">Baixar meus dados</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Um arquivo JSON com sua conta, Voices, Echoes, transcrições, reações, follows e denúncias.
              </p>
              <Button variant="outline" className="mt-4 rounded-xl" disabled={baixarDados.isPending} onClick={() => baixarDados.mutate()}>
                {baixarDados.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
                Baixar meus dados
              </Button>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-rose-200 bg-white p-5 dark:border-rose-900 dark:bg-slate-950">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200"><Trash2 className="size-5" /></div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold">Excluir minha conta</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Remove seus Echoes (com o áudio apagado do armazenamento), suas Voices, reações, follows e sua conta de acesso.
                Denúncias que você fez perdem o vínculo com você, mas o caso denunciado permanece na moderação. Não há como desfazer.
              </p>
              <Button variant="outline" className="mt-4 rounded-xl border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300" onClick={() => setExclusaoAberta(true)}>
                <Trash2 className="mr-2 size-4" /> Excluir minha conta
              </Button>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          <h2 className="font-bold">Documentos</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <Link className="font-semibold text-indigo-600 hover:underline" to="/termos">Termos de Uso</Link>{' · '}
            <Link className="font-semibold text-indigo-600 hover:underline" to="/privacidade">Política de Privacidade</Link>{' · '}
            <Link className="font-semibold text-indigo-600 hover:underline" to="/diretrizes">Diretrizes da Comunidade</Link>
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Outros pedidos sobre seus dados: <Link className="font-semibold text-indigo-600 hover:underline" to="/contato">formulário de contato</Link>
          </p>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          <h2 className="font-bold">Privacidade</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Sua conta não é a sua Voice. Echoes anônimos não mostram Voice, avatar, perfil nem caminho de mídia com identificação da conta. Quem recebe o link de um Echo consegue ouvi-lo sem ter conta — é assim que uma história chega a quem ainda não conhece o shhhh.</p>
        </article>
      </section>

      <Dialog open={exclusaoAberta} onOpenChange={(aberto) => { setExclusaoAberta(aberto); if (!aberto) setSenha('') }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir minha conta</DialogTitle>
            <DialogDescription>
              Isto apaga seus Echoes, suas Voices e sua conta de acesso. Não há como desfazer.
              Confirme com sua senha — sessão aberta em aparelho de terceiro não deve conseguir fazer isso.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
            placeholder="Sua senha"
            aria-label="Senha para confirmar a exclusão"
            autoComplete="current-password"
          />
          <Button
            variant="destructive"
            className="rounded-xl"
            disabled={senha.length < 6 || excluirConta.isPending}
            onClick={() => excluirConta.mutate()}
          >
            {excluirConta.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
            Excluir definitivamente
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  )
}
