import { useEffect } from 'react'

/**
 * Título e diretiva de robôs por rota.
 *
 * Público não é a mesma coisa que indexado. Um Echo aprovado pode ser ouvido
 * por qualquer pessoa com o link — é assim que ele circula no WhatsApp — mas um
 * desabafo pessoal não deve ficar arquivado num buscador por anos. Como isto é
 * uma SPA, a única meta que existe é a do index.html: sem ajustar por rota,
 * `index, follow` valeria para todas as páginas.
 */
export function usePageMeta({ title, robots }: { title?: string; robots?: string }) {
  useEffect(() => {
    const previousTitle = document.title
    if (title) document.title = title

    let tag = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    const previousRobots = tag?.content
    if (robots) {
      if (!tag) {
        tag = document.createElement('meta')
        tag.name = 'robots'
        document.head.appendChild(tag)
      }
      tag.content = robots
    }

    return () => {
      document.title = previousTitle
      if (robots && tag && previousRobots !== undefined) tag.content = previousRobots
    }
  }, [title, robots])
}
