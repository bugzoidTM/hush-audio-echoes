import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Migration aplicada é história: corrigir editando um arquivo antigo quebra a
 * reconstrução do banco (a migration roda antes de a tabela existir) e não
 * alcança quem já aplicou aquele arquivo.
 *
 * Já aconteceu uma vez: `erase_account_data`, criada em 20260824200000, ganhou
 * um DELETE em `legal_acceptances`, que só nasce em 20260825000000. Este teste
 * existe para a próxima vez ser barrada antes do commit.
 */
const pastaDeMigrations = path.resolve(__dirname, '../../supabase/migrations')

interface Migration {
  arquivo: string
  conteudo: string
}

function carregarMigrations(): Migration[] {
  return readdirSync(pastaDeMigrations)
    .filter((nome) => nome.endsWith('.sql'))
    .sort()
    .map((arquivo) => ({ arquivo, conteudo: readFileSync(path.join(pastaDeMigrations, arquivo), 'utf8') }))
}

/** Tabelas de `public` criadas por cada migration, na ordem de aplicação. */
function tabelasCriadas(migrations: Migration[]): Map<string, number> {
  const criacoes = new Map<string, number>()
  migrations.forEach(({ conteudo }, indice) => {
    const padrao = /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+public\.([a-z_][a-z0-9_]*)/gi
    for (const achado of conteudo.matchAll(padrao)) {
      const tabela = achado[1].toLowerCase()
      if (!criacoes.has(tabela)) criacoes.set(tabela, indice)
    }
  })
  return criacoes
}

describe('ordem das migrations', () => {
  const migrations = carregarMigrations()

  it('encontra as migrations do repositório', () => {
    expect(migrations.length).toBeGreaterThan(3)
  })

  it('nenhuma migration referencia tabela criada por outra posterior', () => {
    const criadaEm = tabelasCriadas(migrations)
    const violacoes: string[] = []

    migrations.forEach(({ arquivo, conteudo }, indice) => {
      // Comentários explicam decisões e citam tabelas de propósito.
      const sql = conteudo
        .split('\n')
        .filter((linha) => !linha.trimStart().startsWith('--'))
        .join('\n')

      for (const [tabela, nascimento] of criadaEm) {
        if (nascimento <= indice) continue
        const referencia = new RegExp(`\\bpublic\\.${tabela}\\b`, 'i')
        if (referencia.test(sql)) {
          violacoes.push(`${arquivo} referencia public.${tabela}, criada só em ${migrations[nascimento].arquivo}`)
        }
      }
    })

    expect(violacoes).toEqual([])
  })
})
