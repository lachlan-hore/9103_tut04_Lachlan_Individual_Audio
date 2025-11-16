let composition;
let thresholdSlider;
let thresholdLabel;
let thresholdPanel;
let audioButton;
let canvasElement;
let mixerContainer;
let instructionPanel;

function setup() {
  canvasElement = createCanvas(800, 800);   // Canvas for the artwork
  angleMode(RADIANS);
  noStroke();

  if (window.interactionManager && canvasElement?.elt) {
    window.interactionManager.attachCanvas(canvasElement.elt);
    canvasElement.elt.style.cursor = 'default';
  }

  composition = new Composition(); // Main scene controller
  composition.initLayout();        // Generate wheels and connectors

  if (window.interactionManager) {
    window.interactionManager.setComposition(composition);
    setupThresholdControls();
  }
}

function draw() {
  background(BG_COLOR);
  drawBackgroundPattern();  // Background texture
  if (window.audioManager) {
    window.audioManager.beginFrame();
  }
  composition.update();     // Update animations
  composition.display();    // Draw all elements
  if (window.audioManager) {
    window.audioManager.applyConnectorEffects();
  }
  drawThresholdOverlay();
}

// Simple dotted background texture
function drawBackgroundPattern() {
  noStroke();

  // Small dots
  fill(10, 90, 120, 140);
  for (let i = 0; i < 260; i++) {
    let x = random(width);
    let y = random(height);
    let d = random(2, 5);
    ellipse(x, y, d, d);
  }

  // A few slightly larger, softer dots
  fill(5, 60, 90, 80);
  for (let i = 0; i < 40; i++) {
    let x = random(width);
    let y = random(height);
    let d = random(12, 26);
    ellipse(x, y, d, d);
  }
}

function setupThresholdControls() {
  const manager = window.interactionManager;
  const initialValue = manager ? manager.getMouseThresholdRadius() : 50;

  thresholdPanel = createDiv('');
  thresholdPanel.style('position', 'fixed');
  thresholdPanel.style('top', '20px');
  thresholdPanel.style('left', '20px');
  thresholdPanel.style('background', 'rgba(0, 0, 0, 0.45)');
  thresholdPanel.style('padding', '8px 12px 18px 12px');
  thresholdPanel.style('border-radius', '6px');
  thresholdPanel.style('z-index', '10');
  thresholdPanel.style('color', '#f1f4f6');
  thresholdPanel.style('font-family', 'monospace');
  thresholdPanel.style('font-size', '13px');
  thresholdPanel.style('display', 'flex');
  thresholdPanel.style('flex-direction', 'column');
  thresholdPanel.style('gap', '6px');

  thresholdLabel = createDiv('');
  thresholdLabel.parent(thresholdPanel);

  thresholdSlider = createSlider(10, 125, initialValue, 1);
  thresholdSlider.parent(thresholdPanel);
  thresholdSlider.style('width', '160px');
  thresholdSlider.style('z-index', '10');

  const handleInput = () => {
    const value = thresholdSlider.value();
    if (manager) {
      manager.setMouseThresholdRadius(value);
    }
    updateThresholdLabel(value);
  };

  thresholdSlider.input(handleInput);
  updateThresholdLabel(initialValue);

  manager.onRadiusChange((value) => {
    if (thresholdSlider && thresholdSlider.value() !== value) {
      thresholdSlider.value(value);
    }
    updateThresholdLabel(value);
  });

  setupAudioButton();
  setupMixerUI();
  setupInstructions();
}

function updateThresholdLabel(value) {
  if (!thresholdLabel) return;
  thresholdLabel.html(`Threshold radius: ${Math.round(value)}px`);
}

function setupAudioButton() {
  // forcing a click keeps browsers happy about autoplay policies
  audioButton = createButton('Start Audio');
  audioButton.style('position', 'absolute');
  audioButton.style('left', '50%');
  audioButton.style('top', '50%');
  audioButton.style('transform', 'translate(-50%, -50%)');
  audioButton.style('width', '120px');
  audioButton.style('padding', '6px 10px');
  audioButton.style('border', 'none');
  audioButton.style('border-radius', '4px');
  audioButton.style('font-family', 'monospace');
  audioButton.style('font-size', '13px');
  audioButton.style('background', '#1e90ff');
  audioButton.style('color', '#fff');
  audioButton.style('cursor', 'pointer');
  audioButton.mousePressed(() => {
    if (!window.audioManager) return;
    window.audioManager.enableAudio();
    if (canvasElement?.elt) {
      canvasElement.elt.style.cursor = 'crosshair';
    }
    audioButton.remove();
    audioButton = null;
  });
}

function setupMixerUI() {
  if (mixerContainer) return;
  mixerContainer = createDiv('');
  mixerContainer.style('position', 'fixed');
  mixerContainer.style('right', '20px');
  mixerContainer.style('bottom', '20px');
  mixerContainer.style('display', 'flex');
  mixerContainer.style('gap', '3px');
  mixerContainer.style('padding', '18px');
  mixerContainer.style('background', 'rgba(0, 0, 0, 0.35)');
  mixerContainer.style('border-radius', '10px');
  mixerContainer.style('width', '650px');
  mixerContainer.style('box-sizing', 'border-box');
  mixerContainer.style('justify-content', 'space-between');
  mixerContainer.style('align-items', 'flex-start');

  const configs = [
    { label: 'MASTER', bus: 'master', default: 1 },
    { label: 'SYNTH', bus: 'synth', default: 0.8 },
    { label: 'KICK', bus: 'kick', default: 0.8 },
    { label: 'HAT', bus: 'hihat', default: 0.8 },
    { label: 'SNARE', bus: 'snare', default: 0.8 },
    { label: 'SFX', bus: 'sfx', default: 0.8 },
    { label: 'FLANGE', bus: 'flange', default: 1 },
    { label: 'REVERB', bus: 'reverb', default: 1 },
    { label: 'DELAY', bus: 'delay', default: 1 },
    { label: 'PHASER', bus: 'phaser', default: 1 },
  ];

  configs.forEach((cfg) => {
    const column = createDiv('');
    column.parent(mixerContainer);
    column.style('display', 'flex');
    column.style('flex-direction', 'column');
    column.style('align-items', 'center');
    column.style('color', '#f1f4f6');
    column.style('font-family', 'monospace');
    column.style('font-size', '11px');
    column.style('min-width', '60px');

    const sliderWrap = createDiv('');
    sliderWrap.parent(column);
    sliderWrap.style('position', 'relative');
    sliderWrap.style('width', '18px');
    sliderWrap.style('height', '150px');
    sliderWrap.style('display', 'flex');
    sliderWrap.style('align-items', 'center');
    sliderWrap.style('justify-content', 'center');

    const slider = createSlider(0, 1, cfg.default, 0.01);
    slider.parent(sliderWrap);
    slider.style('transform', 'rotate(-90deg)');
    slider.style('width', '130px');
    slider.style('position', 'relative');
    slider.style('top', '-6px');
    slider.style('margin', '0');
    slider.input(() => {
      if (window.audioManager) {
        if (
          ['flange', 'reverb', 'delay', 'phaser'].includes(cfg.bus)
        ) {
          window.audioManager.setEffectBusLevel(cfg.bus, slider.value());
        } else if (cfg.bus === 'master') {
          window.audioManager.setBusLevel('master', slider.value());
        } else {
          window.audioManager.setBusLevel(cfg.bus, slider.value());
        }
      }
    });

    const label = createSpan(cfg.label);
    label.parent(column);
    label.style('margin-top', '4px');
  });
}

function setupInstructions() {
  instructionPanel = createDiv('');
  instructionPanel.style('position', 'fixed');
  instructionPanel.style('left', '20px');
  instructionPanel.style('bottom', '20px');
  instructionPanel.style('background', 'rgba(0, 0, 0, 0.45)');
  instructionPanel.style('padding', '12px 16px');
  instructionPanel.style('border-radius', '6px');
  instructionPanel.style('color', '#f1f4f6');
  instructionPanel.style('font-family', 'monospace');
  instructionPanel.style('font-size', '12px');
  instructionPanel.style('max-width', '280px');
  instructionPanel.html(
    `
      <div style="font-weight:bold;margin-bottom:6px;">Controls</div>
      <div>- Click to place listener circle</div>
      <div>- Right Click or Shift+Left Click to remove listener</div>
      <div>- Drag slider to change mouse radius</div>
      <div>- Mix faders adjust synth/drums/SFX buses</div>
      <div>- FLANGE/REVERB/DELAY/PHASER sliders control effect wetness</div>
      <div>- Press H to toggle connector effect labels</div>
    `
  );
}

function keyPressed() {
  if (key === 'h' || key === 'H') {
    // quick toggle while testing but might just leave as it helps create interesting patches
    window.DEBUG_CONNECTOR_EFFECTS = !window.DEBUG_CONNECTOR_EFFECTS;
  }
}

function drawThresholdOverlay() {
  const manager = window.interactionManager;
  const audioReady = window.audioManager?.isEnabled();
  if (!manager || !audioReady) return;

  if (manager.mouseOutputEnabled) {
    const pointer = manager.getPointerPosition();
    if (pointer) {
      const radius = manager.getMouseThresholdRadius();
      const fade = manager.pointerFade ?? 1;
      push();
      noFill();
      stroke(255, 120 * fade);
      strokeWeight(2);
      ellipse(pointer.x, pointer.y, radius * 2, radius * 2);
      pop();
    }
  }

  if (manager.listenerThresholds?.length) {
    manager.listenerThresholds.forEach((listener) => {
      push();
      noFill();
      stroke(80, 180, 255, 160);
      strokeWeight(1.5);
      ellipse(listener.x, listener.y, listener.radius * 2, listener.radius * 2);
      const handleSize = 3;
      fill(80, 180, 255, 220);
      noStroke();
      ellipse(listener.x, listener.y, handleSize * 2, handleSize * 2);
      pop();
    });
  }
}
