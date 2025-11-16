const SAMPLE_DIRS = {
  sfx: '../SFX',
  kick: '../Kicks',
  snare: '../Snares',
  hihat: '../Hats',
};

const SCALE_PATTERNS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const WAVEFORMS = ['sine', 'square', 'triangle', 'sawtooth'];

class AudioManager {
  constructor() {
    // start the main audio context once and cache references
    this.audioContext = this.createContext();
    this.loadingPromise = null; // lazy-load manifests/audio once
    this.samplePools = {
      kick: [],
      snare: [],
      hihat: [],
      sfx: [],
    };
    this.buffers = new Map();
    this.waveTypes = new WeakMap();
    this.sampleAssignments = new WeakMap();
    this.specialLoops = new WeakMap();
    this.unlockHandler = () => this.resumeContext();
    this.installUnlockHandlers();
    this.scale = this.generateScaleDefinition(); // keep tonal palette consistent per refresh
    this.audioEnabled = false;
    this.busLevels = {
      master: 1,
      synth: 0.8,
      kick: 0.8,
      snare: 0.8,
      hihat: 0.8,
      sfx: 0.8,
    };
    this.busGains = {};
    this.effectTypes = ['flange', 'reverb', 'delay', 'phaser'];
    this.effectInfluence = this.effectTypes.reduce((acc, type) => {
      acc[type] = 0;
      return acc;
    }, {});
    this.effectLevelOverrides = this.effectTypes.reduce((acc, type) => {
      acc[type] = 1;
      return acc;
    }, {});
    this.maxEffectLevel = 1;
    this.createBuses();
  }

  createContext() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) {
      console.warn('Web Audio API is not supported in this browser.');
      return null;
    }
    return new Context();
  }

  installUnlockHandlers() {
    if (!this.audioContext || this.audioContext.state !== 'suspended') {
      return;
    }

    const events = ['pointerdown', 'touchstart', 'keydown'];
    events.forEach((event) =>
      window.addEventListener(event, this.unlockHandler, { once: true })
    );
  }

  async resumeContext() {
    if (!this.audioContext || this.audioContext.state !== 'suspended') {
      return;
    }

    try {
      await this.audioContext.resume();
    } catch (error) {
      console.error('Failed to resume audio context:', error);
    }
  }

  enableAudio() {
    if (!this.audioContext) return;
    if (this.audioEnabled) return;
    this.audioEnabled = true;
    this.resumeContext();
    this.applyBusLevels();
    console.info('[Audio] Audio engine enabled.');
  }

  isEnabled() {
    return this.audioEnabled;
  }

  async preloadAll() {
    if (!this.audioContext) {
      return Promise.resolve();
    }

    if (!this.loadingPromise) {
      // only cycle the directories once
      this.loadingPromise = this.loadAllSamples();
    }

    return this.loadingPromise;
  }

  async loadAllSamples() {
    const entries = Object.entries(SAMPLE_DIRS);
    const fileLists = await Promise.all(
      entries.map(([, dir]) => this.fetchDirectoryFiles(dir))
    );

    entries.forEach(([key], index) => {
      this.samplePools[key].push(...fileLists[index]);
    });

    const uniquePaths = [
      ...new Set(Object.values(this.samplePools).flat()),
    ];

    await Promise.all(uniquePaths.map((path) => this.loadBuffer(path)));
  }

  async fetchDirectoryFiles(folderPath) {
    const manifest = await this.fetchManifestFiles(folderPath);
    if (manifest.length) return manifest;
    return this.fetchDirectoryListing(folderPath);
  }

  async fetchDirectoryListing(folderPath) {
    try {
      const response = await fetch(`${folderPath}/`);
      if (!response.ok) return [];
      const text = await response.text();
      const matches = [...text.matchAll(/href="([^"]+\.(?:wav|mp3))"/gi)];
      return matches
        .map((match) =>
          this.normalizeSamplePath(folderPath, decodeURIComponent(match[1]))
        )
        .filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  async fetchManifestFiles(folderPath) {
    const manifestUrl = `${folderPath}/manifest.json`;
    try {
      const manifestResponse = await fetch(manifestUrl);
      if (!manifestResponse.ok) return [];
      const manifest = await manifestResponse.json();
      if (Array.isArray(manifest.files)) {
        return manifest.files
          .map((file) => this.normalizeSamplePath(folderPath, file))
          .filter(Boolean);
      }
    } catch (error) {
      // ignore
    }
    return [];
  }

  normalizeSamplePath(folderPath, entry) {
    if (!entry) return null;
    if (/^https?:/i.test(entry)) {
      return entry;
    }
    if (entry.startsWith('/')) {
      return entry;
    }
    if (entry.startsWith('../') || entry.startsWith('./')) {
      return entry;
    }
    return `${folderPath.replace(/\/$/, '')}/${entry}`;
  }

  async loadBuffer(filePath) {
    if (this.buffers.has(filePath)) {
      return this.buffers.get(filePath);
    }

    try {
      // plain fetch/decode so we can reuse decoded data everywhere
      const response = await fetch(filePath);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.buffers.set(filePath, audioBuffer);
      return audioBuffer;
    } catch (error) {
      console.error(`Failed to load audio file: ${filePath}`, error);
      return null;
    }
  }

  updateShapeTone(shapeRef, options = {}) {
    if (!this.audioContext || !shapeRef || !this.audioEnabled) return;
    const influence = options.influence ?? 0;
    if (influence <= 0) {
      this.stopVoice(shapeRef);
      return;
    }

    let voice = this.sampleAssignments.get(shapeRef)?.voice;
    if (!voice) {
      voice = this.startVoice(shapeRef, options);
      if (!voice) return;
    }

    const gainValue = this.volumeFromInfluence(influence);
    this.setVoiceGain(voice, gainValue);
  }

  startVoice(shapeRef, options) {
    if (!this.audioContext) return null;
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const waveform = this.getWaveformForShape(shapeRef);
    oscillator.type = waveform;

    const octave = this.mapHueToOctave(options.hue);
    const midi = this.randomMidiFromScale(octave);
    const frequency = this.midiToFrequency(midi);
    oscillator.frequency.value = frequency;

    gain.gain.value = 0;

    oscillator.start();

    const voice = {
      oscillator,
      gain,
      waveform,
      midi,
      frequency,
      shapeType: options.shapeType || 'unknown',
    };

    const assignment = this.getOrCreateAssignment(shapeRef);
    assignment.voice = voice;
    const destination = this.getBusGain('synth') || this.audioContext.destination;
    oscillator.connect(gain).connect(destination);
    return voice;
  }

  stopVoice(shapeRef) {
    if (!this.audioContext || !shapeRef) return;
    const assignment = this.sampleAssignments.get(shapeRef);
    if (!assignment?.voice) return;

    const voice = assignment.voice;
    const time = this.audioContext.currentTime;
    voice.gain.gain.cancelScheduledValues(time);
    voice.gain.gain.linearRampToValueAtTime(0.0001, time + 0.08);
    voice.oscillator.stop(time + 0.12);
    delete assignment.voice;
  }

  setVoiceGain(voice, value) {
    if (!this.audioContext || !voice) return;
    const time = this.audioContext.currentTime;
    voice.gain.gain.cancelScheduledValues(time);
    voice.gain.gain.linearRampToValueAtTime(value, time + 0.05);
  }

  volumeFromInfluence(influence) {
    const clamped = Math.max(0, Math.min(1, influence));
    return Math.min(0.35, Math.pow(clamped, 1.2) * 0.35);
  }

  triggerPercussion(group, options = {}) {
    if (!this.audioEnabled || !this.audioContext) return;
    const samplePath = this.getSampleForShape(options.shapeRef, group);
    if (!samplePath) return;
    this.playSample(samplePath, group, { velocity: options.velocity });
  }

  updateSpecialLoop(shapeRef, options = {}) {
    if (!this.audioEnabled || !this.audioContext || !shapeRef) {
      this.stopSpecialLoop(shapeRef);
      return;
    }
    const influence = options.influence ?? 0;
    if (influence <= 0) {
      this.stopSpecialLoop(shapeRef);
      return;
    }
    let loop = this.specialLoops.get(shapeRef);
    if (!loop) {
      loop = this.startSpecialLoop(shapeRef);
      if (!loop) return;
    }
    const gainValue = this.volumeFromInfluence(influence);
    this.setLoopGain(loop, gainValue);
  }

  startSpecialLoop(shapeRef) {
    const samplePath = this.getSampleForShape(shapeRef, 'sfx');
    if (!samplePath) return null;
    const buffer = this.buffers.get(samplePath);
    if (!buffer) return null;
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = this.audioContext.createGain();
    gain.gain.value = 0;
    const destination = this.getBusGain('sfx');
    source.connect(gain).connect(destination);
    source.start();
    const loop = { source, gain, samplePath };
    this.specialLoops.set(shapeRef, loop);
    return loop;
  }

  stopSpecialLoop(shapeRef) {
    if (!shapeRef) return;
    const loop = this.specialLoops.get(shapeRef);
    if (!loop || !this.audioContext) return;
    const time = this.audioContext.currentTime;
    loop.gain.gain.cancelScheduledValues(time);
    loop.gain.gain.linearRampToValueAtTime(0.0001, time + 0.1);
    loop.source.stop(time + 0.12);
    this.specialLoops.delete(shapeRef);
  }

  setLoopGain(loop, value) {
    if (!loop || !this.audioContext) return;
    const time = this.audioContext.currentTime;
    loop.gain.gain.cancelScheduledValues(time);
    loop.gain.gain.linearRampToValueAtTime(value, time + 0.05);
  }

  getSpecialLoopLevel(shapeRef) {
    const loop = this.specialLoops.get(shapeRef);
    return loop ? Math.max(0, Math.min(1, loop.gain.gain.value)) : 0;
  }

  getWaveformForShape(shapeRef) {
    if (!shapeRef) return 'sine';
    const assignment = this.getOrCreateAssignment(shapeRef);
    if (!assignment.waveform) {
      assignment.waveform = this.randomChoice(WAVEFORMS) || 'sine';
    }
    return assignment.waveform;
  }

  getSampleForShape(shapeRef, group) {
    const pool = this.samplePools[group] ?? this.samplePools.sfx;
    if (!pool.length) return null;
    if (!shapeRef) {
      return this.randomChoice(pool);
    }
    const assignment = this.getOrCreateAssignment(shapeRef);
    assignment.samples[group] =
      assignment.samples[group] ?? this.randomChoice(pool);
    return assignment.samples[group];
  }

  getOrCreateAssignment(shapeRef) {
    let info = this.sampleAssignments.get(shapeRef);
    if (!info) {
      info = { samples: {} };
      this.sampleAssignments.set(shapeRef, info);
    }
    return info;
  }

  generateScaleDefinition() {
    const type = Math.random() < 0.5 ? 'major' : 'minor';
    const root = Math.floor(Math.random() * 12);
    const semitones = SCALE_PATTERNS[type].map((step) => (root + step) % 12);
    const name = `${NOTE_NAMES[root]} ${type}`;
    console.info(`[Audio] Using ${name} scale for procedural tones.`);
    return { type, root, semitones, name };
  }

  randomMidiFromScale(octave = 4) {
    const scale = this.scale || this.generateScaleDefinition();
    const semitone = this.randomChoice(scale.semitones);
    return 12 * (octave + 1) + semitone;
  }

  mapHueToOctave(hueValue) {
    if (!Number.isFinite(hueValue)) return 4;
    const wrapped = ((hueValue % 360) + 360) % 360;
    const minOct = 2;
    const maxOct = 6;
    return Math.round(minOct + (wrapped / 360) * (maxOct - minOct));
  }

  midiToFrequency(midiNote) {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
  }

  randomChoice(values) {
    if (!values?.length) return null;
    const index = Math.floor(Math.random() * values.length);
    return values[index];
  }

  createImpulseResponse(seconds, decay) {
    // Simple IR generator but good enough for a basic reverb
    const rate = this.audioContext.sampleRate;
    const length = rate * seconds;
    const impulse = this.audioContext.createBuffer(2, length, rate);
    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  setGainSmooth(node, value) {
    if (!node || !this.audioContext) return;
    const time = this.audioContext.currentTime;
    node.gain.cancelScheduledValues(time);
    node.gain.linearRampToValueAtTime(value, time + 0.05);
  }

  beginFrame() {
    // reset per-frame influence so connectors can repopulate
    this.effectTypes.forEach((type) => {
      this.effectInfluence[type] = 0;
    });
  }

  accumulateConnectorInfluence(value, effectType = 'flange') {
    if (!this.audioEnabled) return;
    if (!this.effectInfluence.hasOwnProperty(effectType)) {
      effectType = 'flange';
    }
    this.effectInfluence[effectType] = Math.max(
      this.effectInfluence[effectType],
      value || 0
    );
  }

  applyConnectorEffects() {
    if (!this.audioEnabled) return;
    // drive each bus to however the connectors changed this frame
    this.effectTypes.forEach((type) => {
      const chain = this.effectChains?.[type];
      if (!chain || !chain.setLevel) return;
      const raw = this.effectInfluence[type] || 0;
      const override = this.effectLevelOverrides[type] ?? 1;
      const level = Math.min(1, raw * this.maxEffectLevel * override);
      chain.setLevel(level);
    });
  }

  createEffectChains() {
    if (!this.audioContext) return;
    // treat every connector effect as a tiny parallel bus
    this.effectChains = {
      flange: this.buildFlangerChain(),
      reverb: this.buildReverbChain(),
      delay: this.buildDelayChain(),
      phaser: this.buildPhaserChain(),
    };
  }

  buildFlangerChain() {
    const delay = this.audioContext.createDelay(0.05);
    delay.delayTime.value = 0.012;
    const feedback = this.audioContext.createGain();
    feedback.gain.value = 0.4;
    delay.connect(feedback);
    feedback.connect(delay);

    const wetGain = this.audioContext.createGain();
    wetGain.gain.value = 0;
    delay.connect(wetGain);
    wetGain.connect(this.masterOutput);
    this.masterInput.connect(delay);

    const lfoGain = this.audioContext.createGain();
    lfoGain.gain.value = 0.004;
    const lfo = this.audioContext.createOscillator();
    lfo.frequency.value = 0.2;
    lfo.connect(lfoGain).connect(delay.delayTime);
    lfo.start();

    return {
      setLevel: (level) => this.setGainSmooth(wetGain, level),
    };
  }

  buildReverbChain() {
    // quick impulse response keeps CPU down but still adds space
    const convolver = this.audioContext.createConvolver();
    convolver.buffer = this.createImpulseResponse(2.2, 3);
    const wetGain = this.audioContext.createGain();
    wetGain.gain.value = 0;
    this.masterInput.connect(convolver);
    convolver.connect(wetGain).connect(this.masterOutput);
    return {
      setLevel: (level) => this.setGainSmooth(wetGain, level * 1.2),
    };
  }

  buildDelayChain() {
    // short feedback delay for echoes
    const delay = this.audioContext.createDelay(1.0);
    delay.delayTime.value = 0.28;
    const feedback = this.audioContext.createGain();
    feedback.gain.value = 0.35;
    delay.connect(feedback);
    feedback.connect(delay);
    const wetGain = this.audioContext.createGain();
    wetGain.gain.value = 0;
    this.masterInput.connect(delay);
    delay.connect(wetGain).connect(this.masterOutput);
    return {
      setLevel: (level) => this.setGainSmooth(wetGain, level * 0.8),
    };
  }

  buildPhaserChain() {
    // all-pass filter with LFO creates a phase sweep effect
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'allpass';
    filter.frequency.value = 700;
    const wetGain = this.audioContext.createGain();
    wetGain.gain.value = 0;
    this.masterInput.connect(filter);
    filter.connect(wetGain).connect(this.masterOutput);

    const lfoGain = this.audioContext.createGain();
    lfoGain.gain.value = 1200;
    const lfo = this.audioContext.createOscillator();
    lfo.frequency.value = 0.3;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    return {
      setLevel: (level) => this.setGainSmooth(wetGain, level * 1.1),
    };
  }

  createBuses() {
    if (!this.audioContext) return;
    this.masterInput = this.audioContext.createGain();
    this.masterOutput = this.audioContext.createGain();
    this.masterOutput.gain.value = this.busLevels.master;
    this.masterOutput.connect(this.audioContext.destination);

    this.dryGain = this.audioContext.createGain();
    this.dryGain.gain.value = 1;
    this.masterInput.connect(this.dryGain);
    this.dryGain.connect(this.masterOutput);

    const buses = {};
    ['synth', 'kick', 'snare', 'hihat', 'sfx'].forEach((name) => {
      const gain = this.audioContext.createGain();
      gain.gain.value = this.busLevels[name] ?? 0.8;
      gain.connect(this.masterInput);
      buses[name] = gain;
    });
    this.busGains = buses;

    this.createEffectChains();
  }

  getBusGain(name) {
    return this.busGains?.[name] ?? this.audioContext?.destination;
  }

  playSample(samplePath, group, options = {}) {
    const buffer = this.buffers.get(samplePath);
    if (!buffer || !this.audioContext) return;
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = false;
    const gain = this.audioContext.createGain();
    const velocity = options.velocity ?? 0.8;
    gain.gain.value = velocity;
    const destination = this.getBusGain(group) || this.audioContext.destination;
    source.connect(gain).connect(destination);
    source.start();
  }

  setBusLevel(busName, value) {
    const clamped = Math.max(0, Math.min(1, value));
    this.busLevels[busName] = clamped;
    if (busName === 'master') {
      if (this.masterOutput && this.audioContext) {
        const time = this.audioContext.currentTime;
        this.masterOutput.gain.cancelScheduledValues(time);
        this.masterOutput.gain.linearRampToValueAtTime(clamped, time + 0.1);
      }
      return;
    }
    const bus = this.busGains?.[busName];
    if (bus) {
      const time = this.audioContext.currentTime;
      bus.gain.cancelScheduledValues(time);
      bus.gain.linearRampToValueAtTime(clamped, time + 0.1);
    }
  }

  applyBusLevels() {
    if (!this.audioContext || !this.masterOutput) return;
    const time = this.audioContext.currentTime;
    this.masterOutput.gain.cancelScheduledValues(time);
    this.masterOutput.gain.linearRampToValueAtTime(
      this.busLevels.master,
      time + 0.2
    );
    Object.entries(this.busGains || {}).forEach(([name, gain]) => {
      const level = this.busLevels[name] ?? 0.8;
      gain.gain.cancelScheduledValues(time);
      gain.gain.linearRampToValueAtTime(level, time + 0.1);
    });
  }

  setEffectBusLevel(effectType, value) {
    if (!this.effectLevelOverrides.hasOwnProperty(effectType)) return;
    this.effectLevelOverrides[effectType] = Math.max(0, Math.min(1, value));
  }
}

window.audioManager = new AudioManager();
window.audioManager
  .preloadAll()
  .catch((error) => console.error('Audio preload failed:', error));
