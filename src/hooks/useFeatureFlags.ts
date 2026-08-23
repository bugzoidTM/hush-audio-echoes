import { useQuery } from '@tanstack/react-query'
import { getFeatureFlags } from '@/features/echoes/services/hushApi'
import type { FeatureFlagKey, FeatureFlags } from '@/features/echoes/types'

/**
 * A tabela feature_flags só serve de rollback se o front realmente consultá-la.
 * Antes disso, Communities era montada direto no roteador e na navegação, e
 * desligar a flag não mudava nada na tela.
 *
 * Fail closed: enquanto as flags não chegam — ou se a consulta falhar — a
 * feature fica desligada. É melhor esconder uma área ligada do que exibir uma
 * área desligada de propósito.
 */
export function useFeatureFlags(): { flags: FeatureFlags; loading: boolean } {
  const query = useQuery({
    queryKey: ['feature-flags'],
    queryFn: getFeatureFlags,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
  return { flags: query.data ?? {}, loading: query.isPending }
}

export function useFeatureEnabled(key: FeatureFlagKey): boolean {
  const { flags } = useFeatureFlags()
  return flags[key] === true
}
