class InteractionManager {
  constructor() {
    this.canvas = null;
    this.composition = null;
    this.listenerThresholds = [];
    this.thresholdRadius = 15;
    this.thresholdIdCounter = 0;
    this.referenceCounter = 0;
    this.currentShape = null;
    this.lastLoggedSignature = null;
    this.mouseOutputEnabled = true;
    this.mouseOutputHandlers = new Set();
    this.pointer = null;
    this.thresholdFalloff = 140;
    this.radiusChangeHandlers = new Set();
    this.pointerFade = 0;
    this.lastFadeUpdate = performance.now();
    this.pointerSuppression = null;

    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerLeave = this.handlePointerLeave.bind(this);
    this.boundClick = this.handleClick.bind(this);
    this.boundContextMenu = this.handleContextMenu.bind(this);
    this.boundKeyDown = this.handleKeyDown.bind(this);

    window.addEventListener('keydown', this.boundKeyDown);
  }

  setComposition(composition) {
    this.composition = composition || null;
  }

  attachCanvas(canvasElement) {
    if (this.canvas === canvasElement) return;
    if (this.canvas) {
      this.detachCanvas();
    }
    this.canvas = canvasElement || null;
    if (this.canvas) {
      this.canvas.addEventListener('pointermove', this.boundPointerMove);
      this.canvas.addEventListener('pointerleave', this.boundPointerLeave);
      this.canvas.addEventListener('click', this.boundClick);
      this.canvas.addEventListener('contextmenu', this.boundContextMenu);
    }
  }

  detachCanvas() {
    if (!this.canvas) return;
    this.canvas.removeEventListener('pointermove', this.boundPointerMove);
    this.canvas.removeEventListener('pointerleave', this.boundPointerLeave);
    this.canvas.removeEventListener('click', this.boundClick);
    this.canvas.removeEventListener('contextmenu', this.boundContextMenu);
    this.canvas = null;
  }

  handlePointerMove(evt) {
    if (!this.isAudioReady()) return;
    const position = this.getCanvasPosition(evt);
    if (!position) return;
    this.pointer = position;
    this.pointerFade = 1;
    this.clearPointerSuppressionIfNeeded();
    const shape = this.detectShapeAt(position);
    this.updateCurrentShape(shape);
  }

  handlePointerLeave() {
    if (!this.isAudioReady()) return;
    this.pointer = null;
    this.updateCurrentShape(null);
    this.pointerSuppression = null;
  }

  handleClick(evt) {
    if (evt.button !== 0) return;
    if (!this.isAudioReady()) return;
    const position = this.getCanvasPosition(evt);
    if (!position) return;

    if (evt.shiftKey) {
      this.removeThresholdNear(position);
      return;
    }

    const listener = this.addThreshold(position);
    if (listener && listener.shape) {
      // new listener is treated like a mini mouse so disable the real one for a bit
      this.updateCurrentShape(listener.shape);
    }
  }

  handleContextMenu(evt) {
    evt.preventDefault();
    if (!this.isAudioReady()) return;
    const position = this.getCanvasPosition(evt);
    if (!position) return;
    this.removeThresholdNear(position);
  }

  handleKeyDown(evt) {
    if (evt.code === 'Space') {
      evt.preventDefault();
      this.toggleMouseOutput();
      console.info(
        `[Interaction] Mouse listener ${
          this.mouseOutputEnabled ? 'enabled' : 'muted'
        }.`
      );
      return;
    }

    if (evt.key === '[') {
      this.adjustThresholdRadius(-5);
    } else if (evt.key === ']') {
      this.adjustThresholdRadius(5);
    }
  }

  adjustThresholdRadius(delta) {
    this.setMouseThresholdRadius(this.thresholdRadius + delta);
  }

  setMouseThresholdRadius(value) {
    const numeric = Number(value);
    const clamped = Math.max(10, Math.min(125, Number.isFinite(numeric) ? numeric : this.thresholdRadius));
    if (clamped === this.thresholdRadius) return;
    this.thresholdRadius = clamped;
    this.notifyRadiusChange();
  }

  getMouseThresholdRadius() {
    return this.thresholdRadius;
  }

  isMouseOutputEnabled() {
    return this.mouseOutputEnabled;
  }

  onRadiusChange(handler) {
    if (typeof handler !== 'function') return;
    this.radiusChangeHandlers.add(handler);
  }

  onMouseOutputChange(handler) {
    if (typeof handler !== 'function') return;
    this.mouseOutputHandlers.add(handler);
  }

  notifyRadiusChange() {
    for (const handler of this.radiusChangeHandlers) {
      try {
        handler(this.thresholdRadius);
      } catch (error) {
        console.error('Radius change handler failed', error);
      }
    }
  }

  notifyMouseOutputChange() {
    for (const handler of this.mouseOutputHandlers) {
      try {
        handler(this.mouseOutputEnabled);
      } catch (error) {
        console.error('Mouse output handler failed', error);
      }
    }
  }

  setMouseOutputEnabled(enabled) {
    const desired = Boolean(enabled);
    if (desired === this.mouseOutputEnabled) return;
    this.mouseOutputEnabled = desired;
    this.notifyMouseOutputChange();
  }

  toggleMouseOutput() {
    this.setMouseOutputEnabled(!this.mouseOutputEnabled);
  }

  addThreshold(position) {
    const shape = this.detectShapeAt(position);
    const threshold = {
      id: ++this.thresholdIdCounter,
      x: position.x,
      y: position.y,
      radius: this.thresholdRadius,
      falloff: this.thresholdFalloff,
      intensity: 1,
      shape,
    };
    this.listenerThresholds.push(threshold);
    this.pointerSuppression = {
      x: position.x,
      y: position.y,
      radius: this.thresholdRadius,
    };
    console.info('[Interaction] Added listener threshold:', threshold);
    return threshold;
  }

  removeThresholdNear(position) {
    if (!this.listenerThresholds.length) return null;
    let candidateIndex = -1;
    let candidateDist = Infinity;

    this.listenerThresholds.forEach((threshold, index) => {
      const d = this.distance(position, threshold);
      if (d < candidateDist && d <= threshold.radius) {
        candidateDist = d;
        candidateIndex = index;
      }
    });

    if (candidateIndex === -1) return null;
    const [removed] = this.listenerThresholds.splice(candidateIndex, 1);
    console.info('[Interaction] Removed listener threshold:', removed);
    return removed;
  }

  getCanvasPosition(evt) {
    if (!evt) return null;
    if (typeof evt.offsetX === 'number' && typeof evt.offsetY === 'number') {
      return { x: evt.offsetX, y: evt.offsetY };
    }
    if (!this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
    };
  }

  detectShapeAt(point) {
    if (!this.composition || !point) return null;

    const bead = this.findBead(point);
    if (bead) return bead;

    const connector = this.findConnector(point);
    if (connector) return connector;

    const ring = this.findRing(point);
    if (ring) return ring;

    const wheel = this.findWheel(point);
    if (wheel) return wheel;

    return null;
  }

  findRing(point) {
    if (!this.composition?.wheels?.length) return null;

    let best = null;
    let bestDelta = Infinity;

    for (const wheel of this.composition.wheels) {
      if (!wheel.rings?.length) continue;
      const dx = point.x - wheel.x;
      const dy = point.y - wheel.y;
      const dist = Math.hypot(dx, dy);

      for (let index = 0; index < wheel.rings.length; index++) {
        const ring = wheel.rings[index];
        const bounds = this.getRingVisualBounds(ring);
        if (!bounds) continue;

        if (dist >= bounds.inner && dist <= bounds.outer) {
          const mid = (bounds.inner + bounds.outer) * 0.5;
          const delta = Math.abs(dist - mid);
          if (delta < bestDelta) {
            bestDelta = delta;
            best = { wheel, ring, index, dist, bounds };
          }
        }
      }
    }

    if (!best) return null;

    const ringId = this.ensureRefId(best.ring, 'ring');
    const wheelId = this.ensureRefId(best.wheel, 'wheel');

    return {
      type: 'ring',
      ref: best.ring,
      id: ringId,
      meta: {
        distance: best.dist,
        innerRadius: best.ring.innerR,
        outerRadius: best.ring.outerR,
        visualInnerRadius: best.bounds?.inner ?? best.ring.innerR,
        visualOuterRadius: best.bounds?.outer ?? best.ring.outerR,
        ringIndex: best.index,
        ringType: best.ring.type,
        wheelId,
        wheelPosition: { x: best.wheel.x, y: best.wheel.y },
      },
    };
  }

  getRingVisualBounds(ring) {
    if (!ring) return null;

    const baseInner = Math.max(0, ring.innerR || 0);
    const baseOuter = Math.max(baseInner, ring.outerR || baseInner);
    const type = ring.type || 'solid';

    if (type === 'solid') {
      const thickness = baseOuter - baseInner;
      const coreRadius = baseInner + baseOuter;
      const inner = Math.max(0, coreRadius - thickness * 0.5);
      const outer = coreRadius + thickness * 0.5;
      return { inner, outer };
    }

    if (type === 'dots') {
      const mid = (baseInner + baseOuter) * 0.5;
      const spread = Math.max(baseOuter - baseInner, 8);
      const padding = Math.max(spread * 0.3, 4);
      return {
        inner: Math.max(0, mid - padding),
        outer: mid + padding,
      };
    }

    if (type === 'rays') {
      const padding = 6;
      return {
        inner: Math.max(0, baseInner - padding),
        outer: baseOuter + padding,
      };
    }

    return { inner: baseInner, outer: baseOuter };
  }

  findWheel(point) {
    if (!this.composition?.wheels?.length) return null;

    let nearest = null;
    let nearestDist = Infinity;

    for (const wheel of this.composition.wheels) {
      const dist = this.distance(point, wheel);
      if (dist > wheel.baseRadius) continue;

      if (dist < nearestDist) {
        nearestDist = dist;
        const id = this.ensureRefId(wheel, 'wheel');
        nearest = {
          type: 'wheel',
          ref: wheel,
          id,
          meta: {
            distance: dist,
            radius: wheel.baseRadius,
          },
        };
      }
    }

    return nearest;
  }

  findConnector(point) {
    if (!this.composition?.connectors?.length) return null;

    let best = null;
    let bestDistance = 10;

    for (const connector of this.composition.connectors) {
      const dist = this.sampleConnectorDistance(connector, point);
      if (dist < bestDistance) {
        bestDistance = dist;
        const id = this.ensureRefId(connector, 'connector');
        best = {
          type: 'connector',
          ref: connector,
          id,
          meta: {
            distance: dist,
          },
        };
      }
    }

    return best;
  }

  sampleConnectorDistance(connector, point) {
    const start = {
      x: connector.startWheel?.x ?? 0,
      y: connector.startWheel?.y ?? 0,
    };
    const end = {
      x: connector.endPos?.x ?? 0,
      y: connector.endPos?.y ?? 0,
    };

    const control = {
      x: (start.x + end.x) / 2 + 30 * Math.sin(connector.t),
      y: (start.y + end.y) / 2 + 30 * Math.cos(connector.t),
    };

    let minDistance = Infinity;
    const samples = 24;

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const pos = this.computeQuadraticPoint(start, control, end, t);
      const dist = this.distance(point, pos);
      if (dist < minDistance) {
        minDistance = dist;
      }
    }

    return minDistance;
  }

  computeQuadraticPoint(p0, p1, p2, t) {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;

    return {
      x: uu * p0.x + 2 * u * t * p1.x + tt * p2.x,
      y: uu * p0.y + 2 * u * t * p1.y + tt * p2.y,
    };
  }

  findBead(point) {
    const grid = this.composition?._grid;
    if (!grid?.cells?.length) return null;

    let closest = null;
    let closestDist = Infinity;

    for (const cell of grid.cells) {
      const skipX = Math.abs(point.x - cell.x) > cell.outerRadius * 1.8;
      const skipY = Math.abs(point.y - cell.y) > cell.outerRadius * 1.8;
      if (skipX && skipY) continue;

      for (const bead of cell.beads || []) {
        const dist = this.distance(point, bead);
        const radius = this.getBeadRadius(bead);
        if (dist <= radius && dist < closestDist) {
          closestDist = dist;
          const baseType = bead.special ? 'special-bead' : 'bead';
          const id = this.ensureRefId(bead, baseType);
          closest = {
            type: baseType,
            ref: bead,
            id,
            meta: {
              distance: dist,
              radius,
              special: Boolean(bead.special),
              cellPosition: { x: cell.x, y: cell.y },
            },
          };
        }
      }

      for (const bead of cell.cornerBeads || []) {
        const dist = this.distance(point, bead);
        const radius = this.getCornerBeadRadius(bead);
        if (dist <= radius && dist < closestDist) {
          closestDist = dist;
          const id = this.ensureRefId(bead, 'corner-bead');
          closest = {
            type: 'corner-bead',
            ref: bead,
            id,
            meta: {
              distance: dist,
              radius,
              cellPosition: { x: cell.x, y: cell.y },
            },
          };
        }
      }
    }

    return closest;
  }

  getBeadRadius(bead) {
    const metrics = [
      bead.strokeW,
      bead.strokeH,
      bead.coreD,
      bead.fillW,
      bead.fillH,
      bead.dotW,
      bead.dotH,
    ].filter((value) => typeof value === 'number');

    if (!metrics.length) return 0;
    return Math.max(...metrics) * 0.5 + 4;
  }

  getCornerBeadRadius(bead) {
    const metrics = [
      bead.baseStrokeW,
      bead.baseStrokeH,
      bead.coreD,
      bead.dotW,
      bead.dotH,
    ].filter((value) => typeof value === 'number');

    if (!metrics.length) return 0;
    return Math.max(...metrics) * 0.5 + 6;
  }

  updateCurrentShape(shape) {
    if (this.shapesEqual(shape, this.currentShape)) return;
    this.currentShape = shape;
    this.reportShape(shape);
  }

  shapesEqual(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    return a.type === b.type && a.ref === b.ref;
  }

  reportShape(shape) {
    this.lastLoggedSignature = this.getShapeSignature(shape);
  }

  getShapeSignature(shape) {
    if (!shape) return 'none';
    return `${shape.type}-${shape.id ?? 'anon'}`;
  }

  ensureRefId(ref, prefix) {
    if (!ref) return null;
    if (!ref.__interactionId) {
      this.referenceCounter += 1;
      ref.__interactionId = `${prefix}-${this.referenceCounter}`;
    }
    return ref.__interactionId;
  }

  distance(p1, p2) {
    return Math.hypot((p1?.x ?? 0) - (p2?.x ?? 0), (p1?.y ?? 0) - (p2?.y ?? 0));
  }

  getCurrentShape() {
    return this.currentShape;
  }

  getActiveThresholds() {
    const thresholds = [...this.listenerThresholds];
    const mouseThreshold = this.getMouseThreshold();
    if (mouseThreshold) thresholds.push(mouseThreshold);
    return thresholds;
  }

  getMouseThreshold() {
    if (
      !this.mouseOutputEnabled ||
      !this.pointer ||
      this.pointerFade <= 0.001 ||
      !this.isAudioReady() ||
      this.isPointerSuppressed()
    ) {
      return null;
    }
    return {
      id: 'mouse',
      x: this.pointer.x,
      y: this.pointer.y,
      radius: this.thresholdRadius,
      falloff: this.thresholdFalloff,
      intensity: this.pointerFade,
    };
  }

  getThresholdInfluenceAt(point) {
    if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
      return 0;
    }
    if (!this.isAudioReady()) return 0;

    this.updatePointerFade();

    const thresholds = this.getActiveThresholds();
    if (!thresholds.length) return 0;

    let best = 0;

    for (const threshold of thresholds) {
      const radius = threshold.radius ?? this.thresholdRadius;
      if (!radius) continue;
      const dist = this.distance(point, threshold);
      if (dist > radius) continue;
      const influence = 1 - dist / radius;
      const scaled =
        threshold.intensity !== undefined
          ? influence * threshold.intensity
          : influence;
      if (scaled > best) {
        best = scaled;
      }
    }

    return Math.max(0, Math.min(1, best));
  }

  alphaFromInfluence(baseAlpha, highlightAlpha, influence) {
    const base = Math.max(0, Math.min(255, baseAlpha));
    const hi = Math.max(base, Math.min(255, highlightAlpha));
    const amt = Math.max(0, Math.min(1, influence));
    return base + (hi - base) * amt;
  }

  factorFromInfluence(baseFactor, highlightFactor, influence) {
    const base = Math.max(0, baseFactor);
    const hi = Math.max(base, highlightFactor);
    const amt = Math.max(0, Math.min(1, influence));
    return base + (hi - base) * amt;
  }

  getAlphaForPoint(point, baseAlpha = 90, highlightAlpha = 255) {
    const influence = this.getThresholdInfluenceAt(point);
    return this.alphaFromInfluence(baseAlpha, highlightAlpha, influence);
  }

  getFactorForPoint(point, baseFactor = 0.4, highlightFactor = 1) {
    const influence = this.getThresholdInfluenceAt(point);
    return this.factorFromInfluence(baseFactor, highlightFactor, influence);
  }

  getPointerPosition() {
    if (!this.pointer) return null;
    return { ...this.pointer };
  }

  updatePointerFade() {
    const now = performance.now();
    const deltaSeconds = Math.min(0.2, (now - this.lastFadeUpdate) / 1000);
    this.lastFadeUpdate = now;
    const hasPointer = Boolean(this.pointer);
    const rateUp = 6;
    const rateDown = 2.5;
    if (hasPointer) {
      this.pointerFade = Math.min(
        1,
        this.pointerFade + deltaSeconds * rateUp
      );
    } else {
      this.pointerFade = Math.max(
        0,
        this.pointerFade - deltaSeconds * rateDown
      );
    }
  }

  clearPointerSuppressionIfNeeded() {
    if (!this.pointerSuppression || !this.pointer) return;
    if (this.distance(this.pointer, this.pointerSuppression) >
      this.pointerSuppression.radius) {
      this.pointerSuppression = null;
    }
  }

  isPointerSuppressed() {
    if (!this.pointerSuppression || !this.pointer) return false;
    return (
      this.distance(this.pointer, this.pointerSuppression) <=
      this.pointerSuppression.radius
    );
  }

  isAudioReady() {
    return Boolean(window.audioManager?.isEnabled());
  }
}

window.interactionManager = new InteractionManager();
