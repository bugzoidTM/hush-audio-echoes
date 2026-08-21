import type { ProtectedAudioResult, VoiceProtectionPreset, VoiceProtectionProvider } from '../types'

interface ProtectionSettings {
  pitchFactor: number
  formantFrequency: number
  formantGain: number
}

const settingsByPreset: Record<VoiceProtectionPreset, ProtectionSettings> = {
  natural: { pitchFactor: 0.91, formantFrequency: 1650, formantGain: -3 },
  shadow: { pitchFactor: 0.81, formantFrequency: 1250, formantGain: -6 },
  deep: { pitchFactor: 0.72, formantFrequency: 900, formantGain: -7 },
  soft: { pitchFactor: 1.08, formantFrequency: 2300, formantGain: -3 },
}

function createHannWindow(length: number): Float32Array {
  const window = new Float32Array(length)
  for (let index = 0; index < length; index += 1) {
    window[index] = 0.5 * (1 - Math.cos((2 * Math.PI * index) / (length - 1)))
  }
  return window
}

/**
 * Processador granular OLA: altera a taxa de leitura (altura) enquanto mantém a malha de saída
 * fixa (duração). O estágio de cor formântica altera a ressonância vocal sem fingir anonimato
 * biométrico absoluto.
 */
function pitchShiftPreservingDuration(input: Float32Array, factor: number): Float32Array {
  const grainSize = 1024
  const hop = 256
  const window = createHannWindow(grainSize)
  const output = new Float32Array(input.length + grainSize)
  const normalization = new Float32Array(input.length + grainSize)

  for (let destination = 0, source = 0; destination < input.length; destination += hop, source += hop * factor) {
    const sourceStart = Math.floor(source)
    for (let sample = 0; sample < grainSize; sample += 1) {
      const inputIndex = sourceStart + sample
      const outputIndex = destination + sample
      if (inputIndex >= input.length || outputIndex >= output.length) break
      output[outputIndex] += input[inputIndex] * window[sample]
      normalization[outputIndex] += window[sample]
    }
  }

  const finalOutput = new Float32Array(input.length)
  for (let sample = 0; sample < finalOutput.length; sample += 1) {
    finalOutput[sample] = normalization[sample] > 0.00001 ? output[sample] / normalization[sample] : 0
  }
  return finalOutput
}

function applyFormantColor(samples: Float32Array, sampleRate: number, settings: ProtectionSettings): Float32Array {
  // Aproximação DSP de deslocamento formântico: atenua a região formântica original e injeta
  // uma ressonância deslocada. É propositalmente um estágio separado do pitch shifting.
  const output = new Float32Array(samples.length)
  const angularFrequency = (2 * Math.PI * settings.formantFrequency) / sampleRate
  const radius = 0.95
  let previousInput = 0
  let previousOutput = 0

  for (let index = 0; index < samples.length; index += 1) {
    const resonant = (1 - radius) * samples[index] + 2 * radius * Math.cos(angularFrequency) * previousOutput - (radius * radius) * previousInput
    previousInput = previousOutput
    previousOutput = resonant
    output[index] = samples[index] + resonant * (settings.formantGain / 18)
  }
  return output
}

function normalizeChannels(channels: Float32Array[]): Float32Array[] {
  const peak = channels.reduce((largest, channel) => {
    const channelPeak = channel.reduce((value, sample) => Math.max(value, Math.abs(sample)), 0)
    return Math.max(largest, channelPeak)
  }, 0)
  const gain = peak > 0.92 ? 0.92 / peak : 1
  return channels.map((channel) => channel.map((sample) => sample * gain))
}

function writeWaveFile(channels: Float32Array[], sampleRate: number): Blob {
  const channelCount = channels.length
  const frameCount = channels[0]?.length ?? 0
  const bytesPerSample = 2
  const dataLength = frameCount * channelCount * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(buffer)
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index))
  }

  writeText(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channelCount, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * channelCount * bytesPerSample, true)
  view.setUint16(32, channelCount * bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeText(36, 'data')
  view.setUint32(40, dataLength, true)

  let offset = 44
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][frame]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

export class LocalDspVoiceProtectionProvider implements VoiceProtectionProvider {
  async protectAudio(input: Blob, preset: VoiceProtectionPreset): Promise<ProtectedAudioResult> {
    if (!input.size) throw new Error('Não há áudio para proteger.')
    const AudioContextConstructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextConstructor) throw new Error('Seu navegador não oferece processamento de áudio compatível.')

    const context = new AudioContextConstructor()
    try {
      const source = await context.decodeAudioData(await input.arrayBuffer())
      const settings = settingsByPreset[preset]
      const processedChannels = Array.from({ length: source.numberOfChannels }, (_, channelIndex) => {
        const shifted = pitchShiftPreservingDuration(source.getChannelData(channelIndex), settings.pitchFactor)
        return applyFormantColor(shifted, source.sampleRate, settings)
      })
      const protectedBlob = writeWaveFile(normalizeChannels(processedChannels), source.sampleRate)
      if (!protectedBlob.size) throw new Error('O processamento não gerou áudio.')
      return {
        blob: protectedBlob,
        previewUrl: URL.createObjectURL(protectedBlob),
        preset,
        processed: true,
      }
    } finally {
      await context.close()
    }
  }
}

export const voiceProtectionProvider = new LocalDspVoiceProtectionProvider()
