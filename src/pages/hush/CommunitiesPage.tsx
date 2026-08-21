import { LockKeyhole, Plus, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createCommunity, getCommunities, getMyVoice, joinCommunity } from '@/features/echoes/services/hushApi'
import { useToast } from '@/hooks/use-toast'

export default function CommunitiesPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [joining, setJoining] = useState<string | null>(null)
  const communities = useQuery({ queryKey: ['communities'], queryFn: getCommunities, staleTime: 30_000 })

  const join = async (communityId: string) => {
    setJoining(communityId)
    try {
      await joinCommunity(communityId)
      toast({ title: 'Você entrou na Community.' })
    } catch (error) {
      toast({ title: 'Não foi possível entrar', description: error instanceof Error ? error.message : 'Tente novamente.', variant: 'destructive' })
    } finally {
      setJoining(null)
    }
  }

  return (
    <main className="pb-28"><header className="flex items-end justify-between gap-4 py-6"><div><p className="text-2xl font-black tracking-tight">Communities</p><p className="mt-1 text-sm text-slate-500">Espaços menores para continuar conversas que importam.</p></div><Button size="sm" className="rounded-xl" onClick={() => setCreateOpen(true)}><Plus className="mr-1 size-4" /> Criar</Button></header>{communities.isError ? <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">Não foi possível carregar Communities.</p> : <section className="grid gap-3 sm:grid-cols-2">{(communities.data ?? []).map((community) => <article key={community.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"><div className="flex items-start justify-between gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"><UsersRound className="size-5" /></div>{community.access_type === 'invite_only' && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"><LockKeyhole className="size-3" /> Convite</span>}</div><h2 className="mt-5 text-lg font-bold">{community.name}</h2><p className="mt-2 min-h-10 text-sm text-slate-500">{community.description ?? 'Uma Community criada por uma Voice.'}</p><div className="mt-5 flex gap-2"><Button asChild variant="outline" className="flex-1 rounded-xl"><Link to={`/c/${community.slug}`}>Ver Community</Link></Button><Button className="rounded-xl" disabled={community.access_type === 'invite_only' || joining === community.id} onClick={() => void join(community.id)}>{community.access_type === 'invite_only' ? 'Convite' : joining === community.id ? 'Entrando…' : 'Entrar'}</Button></div></article>)}</section>}{!communities.isLoading && communities.data?.length === 0 && <section className="grid min-h-[45dvh] place-items-center rounded-3xl border border-dashed border-slate-300 px-6 text-center dark:border-slate-700"><div><UsersRound className="mx-auto size-9 text-indigo-500" /><h2 className="mt-3 font-bold">As primeiras Communities estão chegando</h2><p className="mt-2 text-sm text-slate-500">Siga Voices e, quando houver um vínculo, entre em uma conversa mais próxima.</p></div></section>}<CreateCommunityDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => void queryClient.invalidateQueries({ queryKey: ['communities'] })} /></main>
  )
}

function CreateCommunityDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [inviteOnly, setInviteOnly] = useState(false)
  const [creating, setCreating] = useState(false)

  const submit = async () => {
    setCreating(true)
    try {
      const voice = await getMyVoice()
      if (!voice) throw new Error('Crie uma Voice antes de criar uma Community.')
      await createCommunity({ ownerVoiceId: voice.id, name, slug, description, visibility: inviteOnly ? 'private' : 'public', accessType: inviteOnly ? 'invite_only' : 'free' })
      toast({ title: 'Community criada.' })
      setName(''); setSlug(''); setDescription(''); setInviteOnly(false); onOpenChange(false); onCreated()
    } catch (error) {
      toast({ title: 'Não foi possível criar', description: error instanceof Error ? error.message : 'Tente novamente.', variant: 'destructive' })
    } finally { setCreating(false) }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Criar Community</DialogTitle><DialogDescription>Gratuita ou por convite. Pagamentos não fazem parte desta fase.</DialogDescription></DialogHeader><div className="space-y-3"><div><Label htmlFor="community-name">Nome</Label><Input id="community-name" value={name} onChange={(event) => { setName(event.target.value); if (!slug) setSlug(event.target.value.toLowerCase().replace(/\s+/g, '-')) }} /></div><div><Label htmlFor="community-slug">Endereço</Label><Input id="community-slug" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="minha-community" /></div><div><Label htmlFor="community-description">Descrição</Label><Textarea id="community-description" value={description} onChange={(event) => setDescription(event.target.value)} /></div><Label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={inviteOnly} onChange={(event) => setInviteOnly(event.target.checked)} /> Somente por convite</Label><Button className="w-full" disabled={!name.trim() || !slug.trim() || creating} onClick={() => void submit()}>{creating ? 'Criando…' : 'Criar Community'}</Button></div></DialogContent></Dialog>
}
