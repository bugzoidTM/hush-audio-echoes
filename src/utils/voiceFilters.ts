
export type VoiceFilter = 'normal' | 'helium' | 'robot' | 'deep' | 'echo';

export interface VoiceFilterOption {
  value: VoiceFilter;
  label: string;
}

export const voiceFilters: VoiceFilterOption[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'helium', label: 'Hélio' },
  { value: 'robot', label: 'Robô' },
  { value: 'deep', label: 'Grave' },
  { value: 'echo', label: 'Eco' }
];

export const applyVoiceFilter = async (audioBlob: Blob, filter: VoiceFilter): Promise<Blob> => {
  console.log('🎛️ Aplicando filtro de voz:', filter);
  
  if (filter === 'normal') {
    return audioBlob;
  }

  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const filteredBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = filteredBuffer.getChannelData(channel);
      
      for (let i = 0; i < inputData.length; i++) {
        let sample = inputData[i];
        
        switch (filter) {
          case 'helium':
            // Simple pitch shifting approximation
            sample = sample * 1.5;
            break;
          case 'robot':
            // Add digital distortion
            sample = sample > 0 ? 0.3 : -0.3;
            break;
          case 'deep':
            // Lower pitch approximation
            sample = sample * 0.7;
            break;
          case 'echo':
            // Simple echo effect
            const delay = Math.floor(audioBuffer.sampleRate * 0.3);
            if (i >= delay) {
              sample = sample + inputData[i - delay] * 0.3;
            }
            break;
        }
        
        outputData[i] = Math.max(-1, Math.min(1, sample));
      }
    }
    
    // Convert back to blob
    const offlineContext = new OfflineAudioContext(
      filteredBuffer.numberOfChannels,
      filteredBuffer.length,
      filteredBuffer.sampleRate
    );
    
    const source = offlineContext.createBufferSource();
    source.buffer = filteredBuffer;
    source.connect(offlineContext.destination);
    source.start();
    
    const renderedBuffer = await offlineContext.startRendering();
    
    // Convert to WAV format
    const wav = audioBufferToWav(renderedBuffer);
    return new Blob([wav], { type: 'audio/wav' });
    
  } catch (error) {
    console.error('❌ Erro ao aplicar filtro:', error);
    return audioBlob; // Return original if filtering fails
  }
};

// Helper function to convert AudioBuffer to WAV
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const length = buffer.length;
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numberOfChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const bufferSize = 44 + dataSize;
  
  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Convert float32 to int16
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
  }
  
  return arrayBuffer;
}
