
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
  console.log('🎛️ [voiceFilters] Aplicando filtro:', filter);
  
  if (filter === 'normal') {
    console.log('✅ [voiceFilters] Filtro normal - retornando áudio original');
    return audioBlob;
  }

  try {
    // Create audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Convert blob to array buffer
    const arrayBuffer = await audioBlob.arrayBuffer();
    console.log('📥 [voiceFilters] ArrayBuffer obtido, tamanho:', arrayBuffer.byteLength);
    
    // Decode audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    console.log('🔊 [voiceFilters] AudioBuffer decodificado:', {
      duration: audioBuffer.duration,
      channels: audioBuffer.numberOfChannels,
      sampleRate: audioBuffer.sampleRate
    });
    
    // Create new buffer for processed audio
    const filteredBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    
    // Process each channel
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = filteredBuffer.getChannelData(channel);
      
      // Apply filter based on type
      switch (filter) {
        case 'helium':
          applyHeliumFilter(inputData, outputData, audioBuffer.sampleRate);
          break;
        case 'robot':
          applyRobotFilter(inputData, outputData);
          break;
        case 'deep':
          applyDeepFilter(inputData, outputData, audioBuffer.sampleRate);
          break;
        case 'echo':
          applyEchoFilter(inputData, outputData, audioBuffer.sampleRate);
          break;
        default:
          // Copy original data
          outputData.set(inputData);
      }
    }
    
    console.log('🎯 [voiceFilters] Filtro aplicado, convertendo para WAV...');
    
    // Convert filtered buffer to WAV
    const wavBuffer = audioBufferToWav(filteredBuffer);
    const filteredBlob = new Blob([wavBuffer], { type: 'audio/wav' });
    
    console.log('✅ [voiceFilters] Filtro aplicado com sucesso. Tamanho final:', filteredBlob.size);
    
    // Clean up
    await audioContext.close();
    
    return filteredBlob;
    
  } catch (error) {
    console.error('❌ [voiceFilters] Erro ao aplicar filtro:', error);
    return audioBlob; // Return original if filtering fails
  }
};

// Filter implementations
function applyHeliumFilter(inputData: Float32Array, outputData: Float32Array, sampleRate: number) {
  // Pitch shifting approximation - speed up and maintain pitch
  const pitchFactor = 1.5;
  const windowSize = 1024;
  
  for (let i = 0; i < outputData.length; i++) {
    const sourceIndex = Math.floor(i / pitchFactor);
    if (sourceIndex < inputData.length) {
      outputData[i] = inputData[sourceIndex] * 0.8; // Slight volume reduction
    } else {
      outputData[i] = 0;
    }
  }
}

function applyRobotFilter(inputData: Float32Array, outputData: Float32Array) {
  // Bit crushing and digital distortion
  const bitDepth = 4; // Reduce bit depth for robotic sound
  const factor = Math.pow(2, bitDepth - 1);
  
  for (let i = 0; i < inputData.length; i++) {
    // Quantize the signal
    let sample = inputData[i];
    sample = Math.round(sample * factor) / factor;
    
    // Add some digital distortion
    sample = Math.tanh(sample * 2) * 0.7;
    
    outputData[i] = sample;
  }
}

function applyDeepFilter(inputData: Float32Array, outputData: Float32Array, sampleRate: number) {
  // Pitch shift down and add some low-pass filtering
  const pitchFactor = 0.7;
  
  for (let i = 0; i < outputData.length; i++) {
    const sourceIndex = Math.floor(i / pitchFactor);
    if (sourceIndex < inputData.length) {
      outputData[i] = inputData[sourceIndex] * 1.2; // Slight volume boost
    } else {
      outputData[i] = 0;
    }
  }
  
  // Simple low-pass filter
  for (let i = 1; i < outputData.length; i++) {
    outputData[i] = outputData[i] * 0.7 + outputData[i - 1] * 0.3;
  }
}

function applyEchoFilter(inputData: Float32Array, outputData: Float32Array, sampleRate: number) {
  const delayTime = 0.3; // 300ms delay
  const delaySamples = Math.floor(delayTime * sampleRate);
  const feedback = 0.4;
  const wetness = 0.5;
  
  // Copy original signal
  outputData.set(inputData);
  
  // Add echo
  for (let i = delaySamples; i < outputData.length; i++) {
    const echoSample = outputData[i - delaySamples] * feedback;
    outputData[i] = outputData[i] * (1 - wetness) + echoSample * wetness;
  }
}

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
