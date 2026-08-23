import { ArrowRight, Check, Headphones, Mic, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getCategories, completeOnboarding, createVoice } from '@/features/echoes/services/hushApi'
import { suggestVoice } from '@/features/echoes/voiceSuggestion'
import type { EchoCategory } from '@/features/echoes/types'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/use-toast'

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [categories, setCategories] = useState<EchoCategory[]>([])
  const [selected, setSelected] = useState<string[]>([])
  // O nome escolhido no cadastro vira a sugestão da Voice. Antes vinha um
  // aleatório aqui, e quem tinha digitado "Compositor" no cadastro não achava o
  // nome em lugar nenhum.
  const [suggestion] = useState(() => suggestVoice(user?.user_metadata?.username as string | undefined))
  const [name, setName] = useState(suggestion.displayName)
  const [handle, setHandle] = useState(suggestion.handle)
  const [creating, setCreating] = useState(false)

  useEffect(() => { void getCategories().then(setCategories).catch(() => toast({ title: 'Não foi possível carregar os assuntos.', variant: 'destructive' })) }, [toast])
  const toggleCategory = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const finish = async (withVoice: boolean) => {
    if (selected.length < 3) { toast({ title: 'Escolha pelo menos 3 assuntos.', variant: 'destructive' }); return }
    setCreating(true)
    try {
      if (withVoice) await createVoice({ handle, displayName: name })
      await completeOnboarding(selected)
      navigate('/app/echoes', { replace: true })
    } catch (error) { toast({ title: 'Não foi possível concluir', description: error instanceof Error ? error.message : 'Tente novamente.', variant: 'destructive' }) } finally { setCreating(false) }
  }

  return <main className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-xl place-items-center py-8"><section className="w-full rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-950 sm:p-9">{step === 1 && <div className="text-center"><div className="mx-auto grid size-16 place-items-center rounded-3xl bg-indigo-600 text-white"><Headphones className="size-8" /></div><p className="mt-8 text-sm font-bold uppercase tracking-[0.18em] text-indigo-600">Bem-vindo ao shhhh</p><h1 className="mt-3 text-4xl font-black tracking-tight">Ouça o que ninguém conta.</h1><p className="mt-5 leading-relaxed text-slate-600 dark:text-slate-300">Histórias, segredos, desabafos e pensamentos contados pela própria voz. Compartilhe como você é — ou permaneça anônimo.</p><Button size="lg" className="mt-8 w-full rounded-2xl" onClick={() => setStep(2)}>Escolher assuntos <ArrowRight className="ml-2 size-4" /></Button></div>}{step === 2 && <div><div className="flex size-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700"><Sparkles className="size-6" /></div><h1 className="mt-6 text-2xl font-black">O que você quer ouvir?</h1><p className="mt-2 text-sm text-slate-500">Escolha pelo menos 3 assuntos para começar bem.</p><div className="mt-6 grid grid-cols-2 gap-2">{categories.map((category) => <button key={category.id} onClick={() => toggleCategory(category.id)} className={`rounded-xl border p-3 text-left text-sm font-semibold transition ${selected.includes(category.id) ? 'border-indigo-600 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-100' : 'border-slate-200 hover:border-indigo-300 dark:border-slate-700'}`}><span className="flex items-center justify-between gap-2">{category.name}{selected.includes(category.id) && <Check className="size-4" />}</span></button>)}</div><Button size="lg" className="mt-7 w-full rounded-2xl" disabled={selected.length < 3} onClick={() => setStep(3)}>Continuar</Button></div>}{step === 3 && <div><div className="flex size-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700"><Mic className="size-6" /></div><h1 className="mt-6 text-2xl font-black">Crie uma Voice, se quiser</h1><p className="mt-2 text-sm text-slate-500">Ela é sua identidade pública pseudônima. Você também pode publicar anonimamente.</p><div className="mt-6 space-y-3"><Input value={name} onChange={(event) => setName(event.target.value)} aria-label="Nome da Voice" /><div className="flex items-center rounded-xl border border-slate-200 px-3 dark:border-slate-700"><span className="text-slate-400">@</span><Input className="border-0 shadow-none focus-visible:ring-0" value={handle} onChange={(event) => setHandle(event.target.value.replace(/^@/, ''))} aria-label="Handle da Voice" /></div></div><div className="mt-7 grid gap-2 sm:grid-cols-2"><Button size="lg" variant="outline" className="rounded-2xl" disabled={creating} onClick={() => void finish(false)}>Agora não</Button><Button size="lg" className="rounded-2xl" disabled={creating || !name.trim() || !handle.trim()} onClick={() => void finish(true)}>{creating ? 'Entrando…' : 'Criar e entrar'}</Button></div></div>}</section></main>
}
