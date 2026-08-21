import { useOutletContext } from 'react-router-dom'
import { EchoDiscoveryFeed } from '@/features/echoes/components/EchoDiscoveryFeed'
import type { HushOutletContext } from '@/components/hush/HushLayout'

export default function EchoesPage() {
  const { openCreate } = useOutletContext<HushOutletContext>()
  return <EchoDiscoveryFeed onCreate={openCreate} />
}
