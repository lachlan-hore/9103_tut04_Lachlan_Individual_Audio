class Ring {
  constructor(innerR, outerR, type, colorMain, colorSecondary) {
    this.innerR = innerR;
    this.outerR = outerR;
    this.type = type;              // Ring style: solid, dots, or rays
    this.colorMain = colorMain;
    this.colorSecondary = colorSecondary;
    this.noiseOffset = random(1000); // For small animated variation
    this.parentWheel = null;
    this.activeStates = {
      solid: false,
      dots: false,
      rays: false,
    };
  }

  // Update ring animation state
  update() {
    this.noiseOffset += 0.01;
  }

  // Render ring based on its type
  display() {
    if (this.type === "solid") {
      this.drawSolid();
    } else if (this.type === "dots") {
      this.drawDots();
    } else if (this.type === "rays") {
      this.drawRays();
    }
  }

  // Thick outline ring
  drawSolid() {
    
    // Herman: convert solid ring into dashed ring style
    // Set dashed stroke pattern
    drawingContext.setLineDash([8, 6]);  // [dashLength, gapLength]

    const sample = this.getSolidThresholdSample();
    const strokeColor = this.colorFromInfluence(
      this.colorMain,
      sample.influence,
      60,
      255
    );
    stroke(strokeColor);
    strokeWeight(this.outerR - this.innerR);
    noFill();

    let r = this.innerR + this.outerR;
    ellipse(0, 0, r * 2, r * 2);

    // Reset dash so it won't affect other drawings
    drawingContext.setLineDash([]);

    if (window.audioManager) {
      window.audioManager.updateShapeTone(this, {
        shapeType: 'solid-ring',
        influence: sample.influence,
        hue: this.getMainHue(),
      });
      this.handleSolidPercussion(sample.influence);
    }
}

   // Circular ring of animated dots
  drawDots() {
    noStroke();

    let numDots = 36;
    let r = (this.innerR + this.outerR) / 2;
    const interactionPoints = this.getInteractionPoints();
    const anyTouch = this.pointsTouchDotRing(interactionPoints, r, numDots);
    const dotAlpha = anyTouch ? 255 : 35;

    for (let i = 0; i < numDots; i++) {
      let angle = (TWO_PI / numDots) * i;
      let x = r * cos(angle);
      let y = r * sin(angle);

      // Noise adds organic fluctuation
      let d = map(noise(this.noiseOffset + i * 0.1), 0, 1, 4, 8);
      const dotColor = color(this.colorMain);
      dotColor.setAlpha(dotAlpha);
      fill(dotColor);
      ellipse(x, y, d, d);
    }

    this.handleDotPercussion(anyTouch);
  }


  // Radial line pattern
  drawRays() {
    strokeWeight(2);
    noFill();

    let numRays = 40;
    const interactionPoints = this.getInteractionPoints();
    const raysTouch = this.pointsTouchRayRing(interactionPoints, numRays);
    for (let i = 0; i < numRays; i++) {
      let angle = (TWO_PI / numRays) * i;
      let x1 = this.innerR * cos(angle);
      let y1 = this.innerR * sin(angle);
      let x2 = this.outerR * cos(angle);
      let y2 = this.outerR * sin(angle);

      const strokeColor = color(this.colorMain);
      strokeColor.setAlpha(raysTouch ? 255 : 45);
      stroke(strokeColor);
      line(x1, y1, x2, y2);
    }

    this.handleRayPercussion(raysTouch);

    // Small center circle for visual contrast
    noStroke();
    const centerColor = color(this.colorSecondary);
    centerColor.setAlpha(60);
    fill(centerColor);
    ellipse(0, 0, this.innerR * 0.8, this.innerR * 0.8);
  }

  setParentWheel(wheel) {
    this.parentWheel = wheel;
  }

  getSolidThresholdSample(sampleCount = 18) {
    const manager = window.interactionManager;
    const wheel = this.parentWheel;
    if (!manager || !wheel) return { influence: 0, point: null };
    const radius = this.getSolidRadius();
    let best = 0;
    let bestPoint = null;
    for (let i = 0; i < sampleCount; i++) {
      const angle = wheel.rotation + (TWO_PI * i) / sampleCount;
      const x = wheel.x + Math.cos(angle) * radius;
      const y = wheel.y + Math.sin(angle) * radius;
      const influence = manager.getThresholdInfluenceAt({ x, y });
      if (influence > best) {
        best = influence;
        bestPoint = { x, y };
        if (best >= 1) break;
      }
    }
    return { influence: best, point: bestPoint };
  }

  colorFromInfluence(source, influence, baseAlpha, highlightAlpha) {
    const alpha = window.interactionManager
      ? window.interactionManager.alphaFromInfluence(
          baseAlpha,
          highlightAlpha,
          influence
        )
      : highlightAlpha;
    const col = color(source);
    col.setAlpha(alpha);
    return col;
  }

  getSolidRadius() {
    return this.innerR + this.outerR;
  }

  getMainHue() {
    if (this._mainHue === undefined) {
      const baseColor = color(this.colorMain);
      this._mainHue = hue(baseColor);
    }
    return this._mainHue;
  }

  getLocalPointer() {
    const points = this.getInteractionPoints();
    return points[0] ?? null;
  }

  getInteractionPoints() {
    if (!this.parentWheel || !window.interactionManager) return [];
    if (!window.audioManager?.isEnabled()) return [];
    // treat the mouse and every listener as equal citizens
    const manager = window.interactionManager;
    const points = [];
    const pointer = manager.getPointerPosition();
    if (pointer) points.push(this.worldToLocal(pointer));
    if (manager.listenerThresholds?.length) {
      manager.listenerThresholds.forEach((listener) => {
        points.push(this.worldToLocal({ x: listener.x, y: listener.y }));
      });
    }
    return points;
  }

  worldToLocal(point) {
    if (!point || !this.parentWheel) return null;
    const dx = point.x - this.parentWheel.x;
    const dy = point.y - this.parentWheel.y;
    const cosR = Math.cos(this.parentWheel.rotation);
    const sinR = Math.sin(this.parentWheel.rotation);
    return {
      x: dx * cosR + dy * sinR,
      y: -dx * sinR + dy * cosR,
    };
  }

  distance(a, b) {
    return Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0));
  }

  distanceToOrigin(point) {
    return Math.hypot(point?.x ?? 0, point?.y ?? 0);
  }

  getPointerAngle(point) {
    if (!point) return null;
    let angle = Math.atan2(point.y, point.x);
    if (angle < 0) angle += TWO_PI;
    return angle;
  }

  pointsTouchDotRing(points, radius, numDots) {
    // stop early as soon as one probe hits
    return points.some((pt) => this.isPointTouchingDotRing(pt, radius, numDots));
  }

  isPointTouchingDotRing(point, radius, numDots) {
    if (!point) return false;
    const radialDistance = Math.abs(this.distanceToOrigin(point) - radius);
    const radialTolerance = Math.max((this.outerR - this.innerR) * 0.3, 6);
    if (radialDistance > radialTolerance) return false;

    const angle = this.getPointerAngle(point);
    if (angle === null) return false;

    const spacing = TWO_PI / numDots;
    const angleMod = angle % spacing;
    const angularTolerance = Math.min(spacing * 0.25, 0.35);

    return (
      angleMod <= angularTolerance ||
      angleMod >= spacing - angularTolerance
    );
  }

  pointsTouchRayRing(points, numRays) {
    return points.some((pt) => this.isPointTouchingRayRing(pt, numRays));
  }

  isPointTouchingRayRing(point, numRays) {
    if (!point) return false;
    const radial = this.distanceToOrigin(point);
    const radialTolerance = 6;
    if (radial < this.innerR - radialTolerance || radial > this.outerR + radialTolerance) {
      return false;
    }

    const angle = this.getPointerAngle(point);
    if (angle === null) return false;

    const spacing = TWO_PI / numRays;
    const angleMod = angle % spacing;
    const angularTolerance = Math.min(spacing * 0.12, 0.25);

    return (
      angleMod <= angularTolerance ||
      angleMod >= spacing - angularTolerance
    );
  }

  handleSolidPercussion(influence) {
    const manager = window.audioManager;
    if (!manager) return;
    const active = influence > 0.05;
    if (active && !this.activeStates.solid) {
      this.activeStates.solid = true;
    } else if (!active && this.activeStates.solid) {
      this.activeStates.solid = false;
    }
  }

  handleDotPercussion(isActive) {
    const manager = window.audioManager;
    if (!manager) return;
    if (isActive && !this.activeStates.dots) {
      manager.triggerPercussion('kick', { shapeRef: this });
      this.activeStates.dots = true;
    } else if (!isActive && this.activeStates.dots) {
      this.activeStates.dots = false;
    }
  }

  handleRayPercussion(isActive) {
    const manager = window.audioManager;
    if (!manager) return;
    if (isActive && !this.activeStates.rays) {
      manager.triggerPercussion('hihat', { shapeRef: this });
      this.activeStates.rays = true;
    } else if (!isActive && this.activeStates.rays) {
      this.activeStates.rays = false;
    }
  }
}
