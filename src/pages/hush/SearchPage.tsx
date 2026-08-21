import { Search } from 'lucide-react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { searchPublicContent } from '@/features/echoes/services/hushApi'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const results = useQuery({ queryKey: ['search', query], queryFn: () => searchPublicContent(query), enabled: query.trim().length >= 2, staleTime: 15_000 })
  return <main className="pb-28"><header className="py-6"><p className="text-2xl font-black tracking-tight">Buscar</p><p className="mt-1 text-sm text-slate-500">Encontre Voices, categorias e histórias que você quer ouvir.</p></header><div className="relative"><Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" /><Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="h-13 rounded-2xl pl-12" placeholder="Voice, categoria, chamada ou hashtag" /></div><section className="mt-6 space-y-2">{query.trim().length < 2 && <p className="py-12 text-center text-sm text-slate-500">Digite pelo menos 2 caracteres para buscar.</p>}{results.isLoading && <p className="py-12 text-center text-sm text-slate-500">Buscando…</p>}{results.data?.map((result) => <Link key={`${result.result_type}-${result.id}`} to={result.href} className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950"><p className="text-xs font-bold uppercase tracking-wide text-indigo-600">{result.result_type === 'voice' ? 'Voice' : result.result_type === 'echo' ? 'Echo' : 'Categoria'}</p><p className="mt-1 font-bold">{result.label}</p><p className="mt-1 text-sm text-slate-500">{result.subtitle}</p></Link>)}{query.trim().length >= 2 && !results.isLoading && !results.data?.length && <p className="py-12 text-center text-sm text-slate-500">Nada encontrado para “{query}”.</p>}</section></main>
}
