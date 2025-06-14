
export type VoiceFilter = 'normal' | 'robot' | 'helium' | 'deep' | 'echo' | 'whisper' | 'alien' | 'chipmunk';

export const voiceFilters = [
  { value: 'normal' as const, label: 'Normal' },
  { value: 'robot' as const, label: 'Robô' },
  { value: 'helium' as const, label: 'Hélio' },
  { value: 'deep' as const, label: 'Grave' },
  { value: 'echo' as const, label: 'Eco' },
  { value: 'whisper' as const, label: 'Sussurro' },
  { value: 'alien' as const, label: 'Alien' },
  { value: 'chipmunk' as const, label: 'Esquilo' }
];

export const applyVoiceFilter = async (blob: Blob, filter: VoiceFilter): Promise<Blob> => {
  if (filter === 'normal') return blob;

  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Create a new buffer for the filtered audio
    const filteredBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    // Apply different filters based on selection
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = filteredBuffer.getChannelData(channel);

      for (let i = 0; i < inputData.length; i++) {
        let sample = inputData[i];

        switch (filter) {
          case 'robot':
            sample = Math.sign(sample) * Math.pow(Math.abs(sample), 0.5);
            if (i % 100 < 50) sample *= 0.7;
            break;
          
          case 'helium':
            if (i < inputData.length - 1) {
              sample = (sample + inputData[i + 1]) * 0.8;
            }
            break;
          
          case 'deep':
            sample *= 1.2;
            if (i % 3 === 0 && i > 0) {
              sample = (sample + inputData[i - 1]) * 0.6;
            }
            break;
          
          case 'echo':
            if (i > audioBuffer.sampleRate * 0.2) {
              const echoIndex = Math.floor(i - audioBuffer.sampleRate * 0.2);
              sample += inputData[echoIndex] * 0.3;
            }
            break;
          
          case 'whisper':
            sample *= 0.4;
            sample += (Math.random() - 0.5) * 0.02;
            break;
          
          case 'alien':
            const mod = Math.sin(i * 0.01) * 0.5;
            sample = sample * (1 + mod);
            break;
          
          case 'chipmunk':
            sample *= 0.7;
            if (i % 2 === 0 && i < inputData.length - 2) {
              sample = inputData[i + 2] * 0.9;
            }
            break;
        }

        outputData[i] = Math.max(-1, Math.min(1, sample));
      }
    }

    // Convert back to blob
    const length = filteredBuffer.length * filteredBuffer.numberOfChannels * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    
    // Write WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, length - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, filteredBuffer.numberOfChannels, true);
    view.setUint32(24, filteredBuffer.sampleRate, true);
    view.setUint32(28, filteredBuffer.sampleRate * filteredBuffer.numberOfChannels * 2, true);
    view.setUint16(32, filteredBuffer.numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length - 44, true);
    
    let offset = 44;
    for (let i = 0; i < filteredBuffer.length; i++) {
      for (let channel = 0; channel < filteredBuffer.numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, filteredBuffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  } catch (error) {
    console.error('Erro ao aplicar filtro de voz:', error);
    return blob;
  }
};
