import { LogOut, Pencil, Settings2, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { VoiceAvatar } from '@/components/hush/VoiceAvatar'
import { createVoice, getMyVoice, updateMyVoice } from '@/features/echoes/services/hushApi'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/use-toast'

export default function ProfilePage() {
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [voice, setVoice] = useState<Awaited<ReturnType<typeof getMyVoice>>>(null)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [handle, setHandle] = useState('')

  useEffect(() => { void getMyVoice().then((currentVoice) => { setVoice(currentVoice); setName(currentVoice?.display_name ?? ''); setBio(currentVoice?.bio ?? ''); setHandle(currentVoice?.handle.replace('@', '') ?? '') }) }, [])

  const save = async () => {
    try {
      if (voice) await updateMyVoice(voice.id, { displayName: name, bio })
      else await createVoice({ handle, displayName: name, bio })
      const next = await getMyVoice(); setVoice(next); setEditing(false)
      toast({ title: 'Sua Voice foi atualizada.' })
    } catch (error) { toast({ title: 'Não foi possível salvar', description: error instanceof Error ? error.message : 'Tente novamente.', variant: 'destructive' }) }
  }

  const exit = async () => { await signOut(); navigate('/', { replace: true }) }

  return <main className="pb-28"><header className="py-6"><p className="text-2xl font-black tracking-tight">Profile</p><p className="mt-1 text-sm text-slate-500">Sua conta é privada. Sua Voice é o que outras pessoas podem conhecer.</p></header><section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">{voice && !editing ? <><div className="flex items-start justify-between"><VoiceAvatar seed={voice.avatar_seed} label={voice.display_name} className="size-16 rounded-3xl text-xl" /><Button variant="outline" className="rounded-xl" onClick={() => setEditing(true)}><Pencil className="mr-2 size-4" /> Editar</Button></div><h1 className="mt-5 text-2xl font-black">{voice.display_name}</h1><p className="mt-1 text-sm font-semibold text-indigo-600">{voice.handle}</p>{voice.bio && <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{voice.bio}</p>}<Button asChild variant="link" className="mt-4 h-auto p-0"><Link to={`/v/${voice.handle.replace('@', '')}`}>Ver perfil público</Link></Button></> : <div className="space-y-4"><div className="flex items-center gap-3"><div className="grid size-12 place-items-center rounded-2xl bg-indigo-100 text-indigo-700"><UserRound className="size-5" /></div><div><h1 className="font-bold">{voice ? 'Editar sua Voice' : 'Crie sua Voice'}</h1><p className="text-sm text-slate-500">Uma identidade pública pseudônima.</p></div></div><div><Label htmlFor="profile-name">Nome público</Label><Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Voz 82AF" /></div>{!voice && <div><Label htmlFor="profile-handle">@</Label><Input id="profile-handle" value={handle} onChange={(event) => setHandle(event.target.value.replace(/^@/, ''))} placeholder="noiteazul" /></div>}<div><Label htmlFor="profile-bio">Bio</Label><Textarea id="profile-bio" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={280} placeholder="O que você quer compartilhar sobre sua Voice?" /></div><div className="flex gap-2"><Button className="rounded-xl" disabled={!name.trim() || (!voice && !handle.trim())} onClick={() => void save()}>Salvar Voice</Button>{voice && <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>}</div></div>}</section><section className="mt-5 rounded-3xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"><Link to="/app/settings" className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-900"><Settings2 className="size-5 text-slate-500" /> Preferências e segurança</Link><div className="border-t border-slate-100 dark:border-slate-800"><button className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30" onClick={() => void exit()}><LogOut className="size-5" /> Sair da conta {user?.email ? `(${user.email})` : ''}</button></div></section></main>
}
