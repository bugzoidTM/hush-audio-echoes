import { cn } from '@/lib/utils'

interface VoiceAvatarProps {
  seed: string | null
  label: string
  className?: string
}

function hashSeed(seed: string): number {
  return [...seed].reduce((value, character) => ((value << 5) - value + character.charCodeAt(0)) | 0, 0)
}

export function VoiceAvatar({ seed, label, className }: VoiceAvatarProps) {
  const hash = hashSeed(seed ?? label)
  const hue = Math.abs(hash) % 360
  const secondaryHue = (hue + 55) % 360
  const initial = label.replace('@', '').trim().slice(0, 1).toUpperCase() || 'V'

  return (
    <div
      aria-label={`Avatar de ${label}`}
      className={cn('grid size-10 shrink-0 place-items-center rounded-2xl text-sm font-bold text-white shadow-sm', className)}
      style={{
        background: `radial-gradient(circle at 25% 20%, hsl(${secondaryHue} 95% 72%), transparent 34%), linear-gradient(135deg, hsl(${hue} 68% 42%), hsl(${secondaryHue} 74% 30%))`,
      }}
    >
      {initial}
    </div>
  )
}
