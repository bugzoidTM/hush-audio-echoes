import type { Page, Route } from '@playwright/test'

/**
 * Backend simulado para o E2E do fluxo completo.
 *
 * Por que simulado: o E2E roda no CI, que não tem (nem deve ter) credencial da
 * instalação real. A verdade do backend é checada contra produção pelos
 * scripts `scripts/deploy/05`, `07` e `08`; aqui o que se testa é a fiação da
 * interface — se a tela chama o endpoint certo, se o gate de moderação aparece,
 * se a reação sai. As duas coberturas se completam.
 */

const userId = '11111111-1111-1111-1111-111111111111'
const voiceId = '22222222-2222-2222-2222-222222222222'
const echoId = '33333333-3333-3333-3333-333333333333'
const otherEchoId = '44444444-4444-4444-4444-444444444444'

export interface BackendState {
  /** Requisições relevantes, para as asserções do teste. */
  calls: Array<{ method: string; url: string; body?: string }>
  /** Estado de moderação do Echo publicado — o teste avança para 'approved'. */
  moderationStatus: 'pending' | 'approved'
  voiceCreated: boolean
  onboardingComplete: boolean
  following: boolean
  ids: { userId: string; voiceId: string; echoId: string; otherEchoId: string }
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  })
}

function session() {
  return {
    access_token: 'token-de-teste',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'refresh-de-teste',
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'compositor@example.invalid',
      email_confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      app_metadata: { provider: 'email' },
      user_metadata: { username: 'Compositor' },
      identities: [],
    },
  }
}

function echo(state: BackendState, overrides: Record<string, unknown> = {}) {
  return {
    id: echoId,
    public_identity: 'Anônimo',
    voice_handle: null,
    voice_display_name: null,
    avatar_seed: null,
    category_slug: 'desabafo',
    category_name: 'Desabafo',
    title: 'Um Echo de teste',
    description: null,
    transcription: 'transcricao vinda do servidor',
    audio_url: 'data:audio/webm;base64,AA==',
    duration: 12,
    expires_at: new Date(Date.now() + 3 * 3_600_000).toISOString(),
    voice_protection_enabled: false,
    voice_protection_preset: null,
    reaction_counts: {},
    reply_count: 0,
    created_at: new Date().toISOString(),
    next_cursor: null,
    ...overrides,
  }
}

export async function mockBackend(page: Page): Promise<BackendState> {
  const state: BackendState = {
    calls: [],
    moderationStatus: 'pending',
    voiceCreated: false,
    onboardingComplete: false,
    following: false,
    ids: { userId, voiceId, echoId, otherEchoId },
  }

  await page.route('**/supabase.invalido.test/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    state.calls.push({ method, url: path + url.search, body: request.postData() ?? undefined })

    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } })

    // --- Auth -------------------------------------------------------------
    if (path.startsWith('/auth/v1/signup')) return json(route, session())
    if (path.startsWith('/auth/v1/token')) return json(route, session())
    if (path.startsWith('/auth/v1/user')) return json(route, session().user)
    if (path.startsWith('/auth/v1/logout')) return json(route, {})

    // --- Configuração -----------------------------------------------------
    if (path.startsWith('/rest/v1/feature_flags')) {
      return json(route, [
        { key: 'SHHHH_V2_ENABLED', enabled: true },
        { key: 'PROTECT_VOICE_ENABLED', enabled: true },
        { key: 'DISCOVERY_V2_ENABLED', enabled: true },
        { key: 'COMMUNITIES_ENABLED', enabled: false },
        { key: 'MONETIZATION_ENABLED', enabled: false },
      ])
    }
    if (path.startsWith('/rest/v1/categories')) {
      return json(route, [
        { id: 'c1', slug: 'desabafo', name: 'Desabafo', position: 1 },
        { id: 'c2', slug: 'amor', name: 'Amor', position: 2 },
        { id: 'c3', slug: 'trabalho', name: 'Trabalho', position: 3 },
        { id: 'c4', slug: 'familia', name: 'Família', position: 4 },
      ])
    }

    // --- Onboarding -------------------------------------------------------
    if (path.startsWith('/rest/v1/onboarding_preferences')) {
      if (method === 'POST') { state.onboardingComplete = true; return route.fulfill({ status: 201, body: '' }) }
      return json(route, state.onboardingComplete ? [{ completed_at: new Date().toISOString() }] : [])
    }

    // --- Voices -----------------------------------------------------------
    if (path.startsWith('/rest/v1/voices')) {
      if (method === 'POST') { state.voiceCreated = true; return route.fulfill({ status: 201, body: '' }) }
      return json(route, state.voiceCreated
        ? [{ id: voiceId, handle: '@compositor', display_name: 'Compositor', avatar_seed: 'seed', bio: null, status: 'active' }]
        : [])
    }
    if (path.startsWith('/rest/v1/voice_follows')) {
      if (method === 'POST') { state.following = true; return route.fulfill({ status: 201, body: '' }) }
      if (method === 'DELETE') { state.following = false; return route.fulfill({ status: 204, body: '' }) }
      return json(route, state.following ? [{ voice_id: voiceId }] : [])
    }
    if (path.startsWith('/rest/v1/echo_reactions')) return route.fulfill({ status: 201, body: '' })
    if (path.startsWith('/rest/v1/reports')) return route.fulfill({ status: 201, body: '' })

    // --- Publicação e feed ------------------------------------------------
    if (path.startsWith('/functions/v1/publish-echo')) {
      return json(route, {
        id: echoId,
        moderation_status: 'pending',
        created_at: new Date().toISOString(),
        message: 'Seu Echo está em análise e aparecerá no Discovery assim que for aprovado.',
      }, 201)
    }
    if (path.startsWith('/functions/v1/discovery-feed')) {
      const items = state.moderationStatus === 'approved'
        ? [echo(state), echo(state, {
            id: otherEchoId,
            public_identity: 'Compositor',
            voice_handle: '@compositor',
            voice_display_name: 'Compositor',
            avatar_seed: 'seed',
            title: 'Echo de uma Voice',
          })]
        : []
      return json(route, { items, next_cursor: null, has_more: false })
    }
    if (path.startsWith('/functions/v1/transcribe-audio')) return json(route, { text: 'transcricao de teste' })
    if (path.startsWith('/functions/v1/generate-echo-hook')) return json(route, { hook: 'chamada de teste', source: 'local' })

    // --- RPCs -------------------------------------------------------------
    if (path.startsWith('/rest/v1/rpc/get_public_echo')) {
      return json(route, state.moderationStatus === 'approved' ? [echo(state)] : [])
    }
    if (path.startsWith('/rest/v1/rpc/get_my_echo_status')) {
      return json(route, [{ id: echoId, moderation_status: state.moderationStatus, moderated_at: null, published_at: new Date().toISOString() }])
    }
    if (path.startsWith('/rest/v1/rpc/get_public_voice')) {
      return json(route, [{
        id: voiceId,
        handle: '@compositor',
        display_name: 'Compositor',
        bio: null,
        avatar_seed: 'seed',
        active_echo_count: 1,
        permanent_echo_count: 0,
        community_slug: null,
        community_name: null,
      }])
    }
    if (path.startsWith('/rest/v1/rpc/get_public_voice_echoes')) return json(route, [])
    if (path.startsWith('/rest/v1/rpc/get_echo_replies')) return json(route, [])
    if (path.startsWith('/rest/v1/rpc/get_my_voices_feed')) return json(route, [])
    if (path.startsWith('/rest/v1/rpc/record_echo_event')) return json(route, null)
    if (path.startsWith('/rest/v1/rpc/is_moderator')) return json(route, false)
    if (path.startsWith('/rest/v1/rpc/')) return json(route, [])

    return json(route, [])
  })

  return state
}

/** Requisições que bateram num caminho, para as asserções. */
export function callsTo(state: BackendState, fragment: string) {
  return state.calls.filter((call) => call.url.includes(fragment))
}
