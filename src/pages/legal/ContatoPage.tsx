import { CheckCircle2, Loader2, Send } from 'lucide-react'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TurnstileWidget } from '@/features/auth/TurnstileWidget'
import { enviarContato, type AssuntoContato } from '@/features/echoes/services/hushApi'
import { useToast } from '@/hooks/use-toast'
import { LegalLayout } from './LegalLayout'

const assuntos: Array<{ valor: AssuntoContato; rotulo: string }> = [
  { valor: 'privacidade', rotulo: 'Privacidade / meus dados' },
  { valor: 'denuncia', rotulo: 'Denunciar conteúdo' },
  { valor: 'conta', rotulo: 'Problema com a conta' },
  { valor: 'duvida', rotulo: 'Dúvida ou sugestão' },
  { valor: 'outro', rotulo: 'Outro' },
]

export default function ContatoPage() {
  const { toast } = useToast()
  const [assunto, setAssunto] = useState<AssuntoContato>('privacidade')
  const [mensagem, setMensagem] = useState('')
  const [contato, setContato] = useState('')
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)

  const envio = useMutation({
    mutationFn: () => enviarContato({ assunto, mensagem, contato, captchaToken }),
    onSuccess: () => setEnviado(true),
    onError: (erro: Error) => toast({ title: 'Não foi possível enviar', description: erro.message, variant: 'destructive' }),
  })

  if (enviado) {
    return (
      <LegalLayout title="Mensagem enviada" updatedAt="24 de agosto de 2026">
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/40">
          <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-300" />
          <p className="mt-4 font-bold text-slate-950 dark:text-white">Recebemos sua mensagem.</p>
          <p className="mt-2 text-sm">
            Pedidos sobre dados pessoais são respondidos em até 15 dias.
            {contato.trim() ? ' A resposta vai para o contato que você informou.' : ' Você não informou um contato, então não teremos como responder — se precisar de retorno, envie novamente com um e-mail ou @.'}
          </p>
        </div>
      </LegalLayout>
    )
  }

  return (
    <LegalLayout title="Falar com o shhhh" updatedAt="24 de agosto de 2026">
      <p>
        Este é o canal para exercer seus direitos sobre dados pessoais (acesso, correção, portabilidade,
        eliminação), denunciar conteúdo, resolver problemas de conta ou mandar uma sugestão.
      </p>
      <p className="text-sm text-slate-500">
        Para <strong>baixar seus dados</strong> ou <strong>excluir sua conta</strong> você não precisa escrever:
        os dois botões estão em Configurações, dentro do app.
      </p>

      <form
        className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950"
        onSubmit={(evento) => { evento.preventDefault(); envio.mutate() }}
      >
        <div className="space-y-2">
          <Label htmlFor="assunto">Assunto</Label>
          <select
            id="assunto"
            value={assunto}
            onChange={(evento) => setAssunto(evento.target.value as AssuntoContato)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {assuntos.map((item) => <option key={item.valor} value={item.valor}>{item.rotulo}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="contato">Como responder (opcional)</Label>
          <Input
            id="contato"
            value={contato}
            onChange={(evento) => setContato(evento.target.value)}
            placeholder="seu e-mail ou @ de alguma rede"
            maxLength={200}
          />
          <p className="text-xs text-slate-500">
            Sem isto não conseguimos responder. Se o assunto for delicado e você preferir não se identificar, deixe em branco.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mensagem">Mensagem</Label>
          <Textarea
            id="mensagem"
            value={mensagem}
            onChange={(evento) => setMensagem(evento.target.value)}
            placeholder="Conte o que você precisa. Se for sobre um Echo específico, cole o link."
            className="min-h-[160px]"
            maxLength={4000}
            required
          />
          <p className="text-xs text-slate-500">{mensagem.trim().length}/4000 — mínimo de 20 caracteres.</p>
        </div>

        {/* Campo isca contra robôs: escondido de gente, preenchido por script. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

        <TurnstileWidget onToken={setCaptchaToken} />

        <Button type="submit" size="lg" className="w-full rounded-2xl" disabled={mensagem.trim().length < 20 || envio.isPending}>
          {envio.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
          Enviar mensagem
        </Button>
      </form>
    </LegalLayout>
  )
}
