class GUIController {
  constructor() {
    this.manager = null;
    this.canvasElement = null;
    this.thresholdPanel = null;
    this.thresholdBody = null;
    this.thresholdLabel = null;
    this.thresholdSlider = null;
    this.mouseStatusLabel = null;
    this.audioButton = null;
    this.mixerContainer = null;
    this.mixerBody = null;
    this.instructionPanel = null;
    this.instructionBody = null;
    this.initialized = false;
  }

  initialize(canvasElement) {
    this.manager = window.interactionManager || null;
    this.canvasElement = canvasElement || null;
    if (!this.manager || this.initialized) return;

    this.setupThresholdControls();
    this.setupAudioButton();
    this.setupMixerUI();
    this.setupInstructions();
    this.initialized = true;
  }

  setupThresholdControls() {
    if (this.thresholdPanel) return;
    const defaultRadius = 15;
    const initialValue = this.manager
      ? this.manager.getMouseThresholdRadius() || defaultRadius
      : defaultRadius;

    this.thresholdPanel = createDiv('');
    this.thresholdPanel.style('position', 'fixed');
    this.thresholdPanel.style('top', '20px');
    this.thresholdPanel.style('left', '20px');
    this.thresholdPanel.style('background', 'rgba(0, 0, 0, 0.45)');
    this.thresholdPanel.style('padding', '16px 12px 12px 36px');
    this.thresholdPanel.style('border-radius', '6px');
    this.thresholdPanel.style('z-index', '10');
    this.thresholdPanel.style('color', '#f1f4f6');
    this.thresholdPanel.style('font-family', 'monospace');
    this.thresholdPanel.style('font-size', '13px');
    this.thresholdPanel.style('box-sizing', 'border-box');
    this.thresholdPanel.style('min-width', '230px');
    this.thresholdPanel.style('min-height', '48px');

    this.thresholdBody = createDiv('');
    this.thresholdBody.parent(this.thresholdPanel);
    this.thresholdBody.style('display', 'flex');
    this.thresholdBody.style('flex-direction', 'column');
    this.thresholdBody.style('gap', '4px');

    this.thresholdLabel = createDiv('');
    this.thresholdLabel.parent(this.thresholdBody);
    this.thresholdLabel.style('margin', '0 0 2px 0');

    this.thresholdSlider = createSlider(10, 125, initialValue, 1);
    this.thresholdSlider.parent(this.thresholdBody);
    this.thresholdSlider.style('width', '160px');
    this.thresholdSlider.style('z-index', '10');
    this.thresholdSlider.style('margin', '0');

    this.mouseStatusLabel = createDiv('');
    this.mouseStatusLabel.parent(this.thresholdBody);
    this.mouseStatusLabel.style('font-size', '11px');
    this.mouseStatusLabel.style('opacity', '0.8');
    this.mouseStatusLabel.style('margin-top', '2px');
    this.updateMouseStatus(this.manager?.isMouseOutputEnabled?.());

    const handleInput = () => {
      const value = this.thresholdSlider.value();
      if (this.manager) {
        this.manager.setMouseThresholdRadius(value);
      }
      this.updateThresholdLabel(value);
    };

    this.thresholdSlider.input(handleInput);
    this.updateThresholdLabel(initialValue);

    if (this.manager) {
      this.manager.onRadiusChange((value) => {
        if (this.thresholdSlider && this.thresholdSlider.value() !== value) {
          this.thresholdSlider.value(value);
        }
        this.updateThresholdLabel(value);
      });
      this.manager.onMouseOutputChange?.((enabled) => {
        this.updateMouseStatus(enabled);
      });
    }

    this.addPanelToggle(this.thresholdPanel, this.thresholdBody, 'Threshold', 'left');
  }

  updateThresholdLabel(value) {
    if (!this.thresholdLabel) return;
    this.thresholdLabel.html(`Threshold radius: ${Math.round(value)}px`);
  }

  updateMouseStatus(enabled) {
    if (!this.mouseStatusLabel) return;
    const active = enabled !== false;
    this.mouseStatusLabel.html(
      `Cursor output: <span style="color:${active ? '#7ef7a3' : '#f77'};">${
        active ? 'ON' : 'OFF'
      }</span>`
    );
  }

  setupAudioButton() {
    if (this.audioButton) return;
    this.audioButton = createButton('Start Audio');
    this.audioButton.style('position', 'absolute');
    this.audioButton.style('left', '50%');
    this.audioButton.style('top', '50%');
    this.audioButton.style('transform', 'translate(-50%, -50%)');
    this.audioButton.style('width', '120px');
    this.audioButton.style('padding', '6px 10px');
    this.audioButton.style('border', 'none');
    this.audioButton.style('border-radius', '4px');
    this.audioButton.style('font-family', 'monospace');
    this.audioButton.style('font-size', '13px');
    this.audioButton.style('background', '#1e90ff');
    this.audioButton.style('color', '#fff');
    this.audioButton.style('cursor', 'pointer');
    this.audioButton.mousePressed(() => {
      if (!window.audioManager) return;
      window.audioManager.enableAudio();
      if (this.canvasElement?.elt) {
        this.canvasElement.elt.style.cursor = 'crosshair';
      }
      this.audioButton.remove();
      this.audioButton = null;
    });
  }

  setupMixerUI() {
    if (this.mixerContainer) return;
    this.mixerContainer = createDiv('');
    this.mixerContainer.style('position', 'fixed');
    this.mixerContainer.style('right', '20px');
    this.mixerContainer.style('bottom', '20px');
    this.mixerContainer.style('display', 'flex');
    this.mixerContainer.style('gap', '8px');
    this.mixerContainer.style('padding', '28px 18px 18px 18px');
    this.mixerContainer.style('background', 'rgba(0, 0, 0, 0.35)');
    this.mixerContainer.style('border-radius', '10px');
    this.mixerContainer.style('width', '700px');
    this.mixerContainer.style('box-sizing', 'border-box');
    this.mixerContainer.style('min-height', '60px');
    this.mixerContainer.style('justify-content', 'space-between');
    this.mixerContainer.style('align-items', 'flex-start');

    this.mixerBody = createDiv('');
    this.mixerBody.parent(this.mixerContainer);
    this.mixerBody.style('display', 'flex');
    this.mixerBody.style('gap', '8px');

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
      column.parent(this.mixerBody);
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
        if (!window.audioManager) return;
        if (['flange', 'reverb', 'delay', 'phaser'].includes(cfg.bus)) {
          window.audioManager.setEffectBusLevel(cfg.bus, slider.value());
        } else {
          window.audioManager.setBusLevel(cfg.bus, slider.value());
        }
      });

      const label = createSpan(cfg.label);
      label.parent(column);
      label.style('margin-top', '4px');
    });

    this.addPanelToggle(this.mixerContainer, this.mixerBody, 'Mixer');
  }

  setupInstructions() {
    if (this.instructionPanel) return;
    this.instructionPanel = createDiv('');
    this.instructionPanel.style('position', 'fixed');
    this.instructionPanel.style('top', '20px');
    this.instructionPanel.style('right', '20px');
    this.instructionPanel.style('background', 'rgba(0, 0, 0, 0.45)');
    this.instructionPanel.style('padding', '28px 16px 16px 16px');
    this.instructionPanel.style('border-radius', '6px');
    this.instructionPanel.style('color', '#f1f4f6');
    this.instructionPanel.style('font-family', 'monospace');
    this.instructionPanel.style('font-size', '12px');
    this.instructionPanel.style('max-width', '280px');
    this.instructionPanel.style('box-sizing', 'border-box');
    this.instructionPanel.style('min-height', '60px');

    this.instructionBody = createDiv('');
    this.instructionBody.parent(this.instructionPanel);
    this.instructionBody.html(
      `
        <div style="font-weight:bold;margin-bottom:6px;">Controls</div>
        <div>- Click to place listener circle</div>
        <div>- Right Click or Shift+Left Click to remove listener</div>
        <div>- Drag slider to change mouse threshold radius</div>
        <div>- Press Space to toggle mouse output</div>
        <div>- Mix faders adjust synth/drums/SFX buses</div>
        <div>- FLANGE/REVERB/DELAY/PHASER faders control effect wetness</div>
        <div>- Use the +/- buttons to hide or show each UI panel</div>
        <div>- Press H to toggle connector effect labels</div>
      `
    );

    this.addPanelToggle(this.instructionPanel, this.instructionBody, 'Instructions');
  }

  addPanelToggle(panel, content, label, buttonPosition = 'right') {
    if (!panel || !content) return;
    const collapsedPadding = '4px';
    const collapsedSize = '34px';
    const btn = createButton('−');
    btn.parent(panel);
    btn.style('position', 'absolute');
    btn.style('top', '6px');
    if (buttonPosition === 'left') {
      btn.style('left', '6px');
    } else {
      btn.style('right', '6px');
    }
    btn.style('width', '22px');
    btn.style('height', '22px');
    btn.style('padding', '0');
    btn.style('border', 'none');
    btn.style('border-radius', '4px');
    btn.style('font-family', 'monospace');
    btn.style('font-size', '12px');
    btn.style('background', '#233547');
    btn.style('color', '#f1f4f6');
    btn.attribute('title', `Hide ${label}`);

    let visible = true;
    content._originalDisplay =
      content._originalDisplay || content.elt.style.display || 'block';
    const styleKeys = [
      'width',
      'height',
      'padding',
      'min-width',
      'min-height',
      'background',
    ];
    const saved = {};
    styleKeys.forEach((key) => {
      saved[key] = panel.elt.style.getPropertyValue(key);
    });
    if (!saved.background) {
      saved.background = 'rgba(0, 0, 0, 0.45)';
    }

    const restoreStyles = () => {
      styleKeys.forEach((key) => {
        if (saved[key]) {
          panel.style(key, saved[key]);
        } else {
          panel.style(key, '');
        }
      });
    };

    const applyState = () => {
      btn.html(visible ? '−' : '+');
      btn.attribute('title', `${visible ? 'Hide' : 'Show'} ${label}`);
      if (visible) {
        content.style('display', content._originalDisplay);
        restoreStyles();
      } else {
        content.style('display', 'none');
        panel.style('width', collapsedSize);
        panel.style('height', collapsedSize);
        panel.style('padding', collapsedPadding);
        panel.style('min-width', collapsedSize);
        panel.style('min-height', collapsedSize);
        panel.style('background', 'rgba(0, 0, 0, 0.65)');
      }
    };

    btn.mousePressed(() => {
      visible = !visible;
      applyState();
    });

    applyState();
  }

  handleKeyPressed(keyValue) {
    if (keyValue === 'h' || keyValue === 'H') {
      window.DEBUG_CONNECTOR_EFFECTS = !window.DEBUG_CONNECTOR_EFFECTS;
    }
  }

  drawThresholdOverlay() {
    const audioReady = window.audioManager?.isEnabled();
    if (!this.manager || !audioReady) return;

    const pointer = this.manager.getPointerPosition();
    if (pointer) {
      const radius = this.manager.getMouseThresholdRadius();
      const fade = this.manager.pointerFade ?? 1;
      const active =
        this.manager.isMouseOutputEnabled?.() ?? this.manager.mouseOutputEnabled;
      push();
      noFill();
      if (active) {
        stroke(255, 120 * fade);
      } else {
        const alpha = Math.max(80, 180 * fade);
        stroke(255, 80, 80, alpha);
      }
      strokeWeight(2);
      ellipse(pointer.x, pointer.y, radius * 2, radius * 2);
      pop();
    }

    if (this.manager.listenerThresholds?.length) {
      this.manager.listenerThresholds.forEach((listener) => {
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
}

window.guiController = new GUIController();
