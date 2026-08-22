import { Pause, Play, RotateCcw, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { trackEchoEvent } from '@/features/analytics/services/analytics'
import { cn } from '@/lib/utils'

interface EchoPlayerProps {
  echoId: string
  audioUrl: string
  duration: number
  onStarted?: () => void
  active?: boolean
}

export function EchoPlayer({ echoId, audioUrl, duration, onStarted, active = true }: EchoPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const milestones = useRef(new Set<number>())
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  // Sem isto o play falho ficava mudo: o clique não fazia nada visível.
  const [playbackError, setPlaybackError] = useState<string | null>(null)

  useEffect(() => {
    if (!active && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause()
      setPlaying(false)
    }
  }, [active])

  useEffect(() => () => {
    audioRef.current?.pause()
  }, [])

  const effectiveDuration = Number.isFinite(duration) && duration > 0 ? duration : 1
  const percentage = Math.min(100, (currentTime / effectiveDuration) * 100)

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      try {
        setPlaybackError(null)
        await audio.play()
        onStarted?.()
        setPlaying(true)
        if (currentTime > 0) void trackEchoEvent(echoId, 'replay', currentTime)
        else void trackEchoEvent(echoId, 'play_start', 0)
      } catch {
        setPlaying(false)
        setPlaybackError('Não foi possível reproduzir este Echo. O áudio pode ter expirado.')
      }
      return
    }
    audio.pause()
    setPlaying(false)
  }

  const onTimeUpdate = () => {
    const audio = audioRef.current
    if (!audio) return
    const position = audio.currentTime
    setCurrentTime(position)
    const progress = position / effectiveDuration
    const checkpoints: Array<[number, 'play_25' | 'play_50' | 'play_70']> = [
      [0.25, 'play_25'],
      [0.5, 'play_50'],
      [0.7, 'play_70'],
    ]
    for (const [threshold, event] of checkpoints) {
      if (progress >= threshold && !milestones.current.has(threshold)) {
        milestones.current.add(threshold)
        void trackEchoEvent(echoId, event, position)
      }
    }
  }

  const restart = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = 0
    setCurrentTime(0)
    void togglePlayback()
  }

  return (
    <div className="space-y-3">
      <audio
        ref={audioRef}
        preload="metadata"
        src={audioUrl}
        onTimeUpdate={onTimeUpdate}
        onPause={() => setPlaying(false)}
        onError={() => {
          setPlaying(false)
          setPlaybackError('O áudio deste Echo não está disponível.')
        }}
        onEnded={() => {
          setPlaying(false)
          setCurrentTime(effectiveDuration)
          void trackEchoEvent(echoId, 'play_complete', effectiveDuration)
        }}
      />
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="icon"
          onClick={togglePlayback}
          className="size-12 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-950/25 transition-transform duration-150 hover:bg-indigo-500 active:scale-95"
          aria-label={playing ? 'Pausar Echo' : 'Ouvir Echo'}
        >
          {playing ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
        </Button>
        <div className="min-w-0 flex-1">
          <div className="relative h-10 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800" aria-hidden="true">
            <div className="absolute inset-y-0 left-0 bg-indigo-100 dark:bg-indigo-900/50" style={{ width: `${percentage}%` }} />
            <div className="absolute inset-x-3 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-80">
              {Array.from({ length: 36 }, (_, index) => {
                const height = 18 + ((index * 19 + echoId.charCodeAt(index % echoId.length)) % 20)
                const isPlayed = index / 36 <= percentage / 100
                return <span key={index} className={cn('w-1 rounded-full transition-colors', isPlayed ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600')} style={{ height }} />
              })}
            </div>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{formatTime(currentTime)}</span>
            <span className="inline-flex items-center gap-1"><Volume2 className="size-3" /> {formatTime(effectiveDuration)}</span>
          </div>
        </div>
        {currentTime >= effectiveDuration && (
          <Button size="icon" variant="ghost" className="rounded-xl" onClick={restart} aria-label="Ouvir novamente">
            <RotateCcw className="size-4" />
          </Button>
        )}
      </div>
      {playbackError && <p role="status" className="text-xs font-medium text-rose-600 dark:text-rose-400">{playbackError}</p>}
    </div>
  )
}

function formatTime(value: number): string {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
  return `${Math.floor(safeValue / 60)}:${String(safeValue % 60).padStart(2, '0')}`
}
