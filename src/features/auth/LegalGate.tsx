import { FileText, Loader2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DOCUMENT_VERSIONS, acceptCurrentDocuments, hasCurrentLegalAcceptance } from '@/features/auth/legalAcceptance'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/use-toast'

/**
 * Guarda de aceite dentro do produto.
 *
 * Registrar o aceite no cadastro não bastava: uma conta criada antes dos
 * documentos existirem, ou cujo registro falhou, seguia usando tudo
 * normalmente. E quando houver Termos 2.0, é aqui que o novo aceite é pedido —
 * sem página nova e sem deslogar ninguém.
 *
 * Não bloqueia por erro de rede: trancar o produto inteiro por uma consulta que
 * falhou é pior do que um aceite atrasado, e a próxima navegação tenta de novo.
 */
export function LegalGate() {
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const aceite = useQuery({
    queryKey: ['aceite-legal', user?.id],
    queryFn: hasCurrentLegalAcceptance,
    enabled: Boolean(user),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })

  const aceitar = useMutation({
    mutationFn: acceptCurrentDocuments,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['aceite-legal'] })
      toast({ title: 'Obrigado. Aceite registrado.' })
    },
    onError: (erro: Error) => toast({ title: 'Não foi possível registrar', description: erro.message, variant: 'destructive' }),
  })

  const precisaAceitar = Boolean(user) && aceite.isSuccess && aceite.data === false

  return (
    <Dialog open={precisaAceitar}>
      {/* Sem botão de fechar: a saída daqui é aceitar ou sair da conta. */}
      <DialogContent className="[&>button]:hidden" onInteractOutside={(evento) => evento.preventDefault()} onEscapeKeyDown={(evento) => evento.preventDefault()}>
        <DialogHeader>
          <div className="mb-2 grid size-11 place-items-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
            <FileText className="size-5" />
          </div>
          <DialogTitle>Antes de continuar</DialogTitle>
          <DialogDescription>
            Precisamos do seu aceite dos documentos vigentes desta conta. Leva um minuto e vale para tudo que você faz aqui.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <p>
            <Link to="/termos" target="_blank" className="font-semibold text-indigo-600 hover:underline">Termos de Uso {DOCUMENT_VERSIONS.terms}</Link>{' · '}
            <Link to="/privacidade" target="_blank" className="font-semibold text-indigo-600 hover:underline">Privacidade {DOCUMENT_VERSIONS.privacy}</Link>{' · '}
            <Link to="/diretrizes" target="_blank" className="font-semibold text-indigo-600 hover:underline">Diretrizes {DOCUMENT_VERSIONS.guidelines}</Link>
          </p>
          <p className="rounded-xl bg-slate-100 p-3 text-xs dark:bg-slate-900">
            Ao continuar você declara ter <strong>18 anos ou mais</strong> e aceitar os três documentos.
            Lembre que publicar como anônimo esconde você das outras pessoas, não do serviço.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button className="rounded-xl" disabled={aceitar.isPending} onClick={() => aceitar.mutate()}>
            {aceitar.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Aceitar e continuar
          </Button>
          <Button variant="outline" className="rounded-xl" disabled={aceitar.isPending} onClick={() => void signOut()}>
            Sair da conta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
