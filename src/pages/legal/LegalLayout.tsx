import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePageMeta } from '@/hooks/usePageMeta'

/**
 * Moldura dos documentos públicos. Ficam fora do HushLayout de propósito:
 * ninguém deveria precisar de conta para ler os termos aos quais será
 * submetido, nem a política de privacidade antes de decidir se entra.
 */
export function LegalLayout({ title, updatedAt, children }: { title: string; updatedAt: string; children: ReactNode }) {
  usePageMeta({ title: `${title} — shhhh`, robots: 'index, follow' })

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-8 sm:px-8">
      <div className="flex items-center justify-between gap-3">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white">
          <ChevronLeft className="size-4" /> shhhh
        </Link>
        <nav className="flex gap-3 text-sm font-semibold text-slate-500">
          <Link to="/termos" className="hover:text-indigo-600">Termos</Link>
          <Link to="/privacidade" className="hover:text-indigo-600">Privacidade</Link>
          <Link to="/diretrizes" className="hover:text-indigo-600">Diretrizes</Link>
        </nav>
      </div>

      <header className="mt-8">
        <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">Última atualização: {updatedAt}</p>
      </header>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">{children}</div>

      <footer className="mt-16 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-800">
        Dúvidas ou pedidos sobre seus dados: <a className="font-semibold text-indigo-600 hover:underline" href="mailto:privacidade@shhhh.me">privacidade@shhhh.me</a>
      </footer>
    </main>
  )
}

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-slate-950 dark:text-white">{titulo}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}
