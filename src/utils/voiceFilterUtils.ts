
export const applyVoiceFilterToContext = (audioCtx: AudioContext, sourceNode: MediaElementAudioSourceNode, filterType?: string) => {
  let currentNode: AudioNode = sourceNode;

  switch (filterType) {
    case 'robot':
      // Robot effect using bit crusher simulation
      const robotGain = audioCtx.createGain();
      robotGain.gain.value = 0.3;
      const robotFilter = audioCtx.createBiquadFilter();
      robotFilter.type = 'lowpass';
      robotFilter.frequency.value = 2000;
      currentNode.connect(robotGain);
      robotGain.connect(robotFilter);
      currentNode = robotFilter;
      break;

    case 'helium':
      // Helium effect using pitch shift simulation
      const heliumGain = audioCtx.createGain();
      heliumGain.gain.value = 0.8;
      const heliumFilter = audioCtx.createBiquadFilter();
      heliumFilter.type = 'highpass';
      heliumFilter.frequency.value = 800;
      heliumFilter.Q.value = 5;
      currentNode.connect(heliumGain);
      heliumGain.connect(heliumFilter);
      currentNode = heliumFilter;
      break;

    case 'deep':
      // Deep voice effect
      const deepGain = audioCtx.createGain();
      deepGain.gain.value = 1.2;
      const deepFilter = audioCtx.createBiquadFilter();
      deepFilter.type = 'lowpass';
      deepFilter.frequency.value = 500;
      deepFilter.Q.value = 3;
      currentNode.connect(deepGain);
      deepGain.connect(deepFilter);
      currentNode = deepFilter;
      break;

    case 'echo':
      // Echo effect using delay
      const echoDelay = audioCtx.createDelay(0.5);
      echoDelay.delayTime.value = 0.3;
      const echoGain = audioCtx.createGain();
      echoGain.gain.value = 0.4;
      const echoFeedback = audioCtx.createGain();
      echoFeedback.gain.value = 0.3;
      
      currentNode.connect(echoDelay);
      echoDelay.connect(echoGain);
      echoGain.connect(echoFeedback);
      echoFeedback.connect(echoDelay);
      
      // Mix dry and wet signals
      const echoMixer = audioCtx.createGain();
      currentNode.connect(echoMixer);
      echoGain.connect(echoMixer);
      currentNode = echoMixer;
      break;

    case 'whisper':
      // Whisper effect using low gain and high-frequency filtering
      const whisperGain = audioCtx.createGain();
      whisperGain.gain.value = 0.3;
      const whisperFilter = audioCtx.createBiquadFilter();
      whisperFilter.type = 'highpass';
      whisperFilter.frequency.value = 1000;
      currentNode.connect(whisperGain);
      whisperGain.connect(whisperFilter);
      currentNode = whisperFilter;
      break;

    case 'alien':
      // Alien effect using ring modulation simulation
      const alienOscillator = audioCtx.createOscillator();
      alienOscillator.frequency.value = 30;
      alienOscillator.type = 'sine';
      const alienGain = audioCtx.createGain();
      alienGain.gain.value = 0.7;
      const alienModulator = audioCtx.createGain();
      
      alienOscillator.connect(alienModulator.gain);
      currentNode.connect(alienModulator);
      alienModulator.connect(alienGain);
      alienOscillator.start();
      currentNode = alienGain;
      break;

    case 'chipmunk':
      // Chipmunk effect using high-frequency emphasis
      const chipmunkGain = audioCtx.createGain();
      chipmunkGain.gain.value = 0.9;
      const chipmunkFilter = audioCtx.createBiquadFilter();
      chipmunkFilter.type = 'highshelf';
      chipmunkFilter.frequency.value = 2000;
      chipmunkFilter.gain.value = 10;
      currentNode.connect(chipmunkGain);
      chipmunkGain.connect(chipmunkFilter);
      currentNode = chipmunkFilter;
      break;

    default:
      // Normal - no filter
      break;
  }

  // Connect to destination
  currentNode.connect(audioCtx.destination);
};
