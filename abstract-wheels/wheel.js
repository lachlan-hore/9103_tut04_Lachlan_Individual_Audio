class Wheel {
  constructor(x, y, baseRadius, palette) {
    this.x = x;
    this.y = y;
    this.baseRadius = baseRadius;
    this.palette = palette;   // Color set for this wheel
    this.rings = [];          // All ring layers inside the wheel

    this.rotation = random(TWO_PI);          // Initial rotation
    this.rotationSpeed = random(-0.01, 0.01); // Slow spinning motion
    this.outlineActive = false;
  }

  // Create multiple ring layers with random types and colors
  initRings() {
    let numRings = floor(random(3, 6));
    let step = this.baseRadius / numRings;
    let currentInner = 0;

    for (let i = 0; i < numRings; i++) {
      let innerR = currentInner;
      let outerR = currentInner + step;
      currentInner = outerR;

      // Random ring type
      let rnd = random();
      let type = rnd < 0.33 ? "solid" : rnd < 0.66 ? "dots" : "rays";

      // Lachlan: force last ring to be solid
      if (i === numRings - 1) type = "solid";

      let mainColor = random(this.palette);
      let secondaryColor = random(this.palette);

      const ring = new Ring(innerR, outerR, type, mainColor, secondaryColor);
      ring.setParentWheel(this);
      this.rings.push(ring);
    }
  }

  // Update wheel rotation and ring animations
  update() {
    this.rotation += this.rotationSpeed;
    for (let r of this.rings) r.update();
  }

  // Draw wheel, its shadows, and all ring layers
  display() {
    push();
    translate(this.x, this.y);
    rotate(this.rotation);
    const manager = window.interactionManager;

    // Large soft background discs to increase visual density
    noStroke();
    fill(0, 35);
    ellipse(0, 0, this.baseRadius * 3.2, this.baseRadius * 3.2);

    fill(0, 55);
    ellipse(0, 0, this.baseRadius * 2.6, this.baseRadius * 2.6);

    // Offset shadow closest to the wheel
    fill(0, 80);
    ellipse(4, 6, this.baseRadius * 2.1, this.baseRadius * 2.1);

    // Herman:
    // add a coloured core circle in the centre of the wheel
    // to echo the painted artwork's central "eye" motif.
    // --------------------------------------------------
    noStroke();
    const corePoint = { x: this.x, y: this.y };
    let coreColor = color(this.palette[0]); // use the first colour in the palette
    const coreAlpha = manager
      ? manager.getAlphaForPoint(corePoint, 60, 255)
      : 255;
    coreColor.setAlpha(coreAlpha);
    fill(coreColor);
    ellipse(0, 0, this.baseRadius * 0.6, this.baseRadius * 0.6);

    if (window.audioManager) {
      window.audioManager.updateShapeTone(this, {
        shapeType: 'wheel-core',
        influence: manager ? manager.getThresholdInfluenceAt(corePoint) : 0,
        hue: this.getCoreHue(),
      });
    }

    // Draw all rings
    for (let r of this.rings) r.display();

    // Herman:
    // add a subtle outer outline around the main wheel area
    // to make the overall structure slightly clearer.
    // --------------------------------------------------
    noFill();
    const outlineColor = color(255);
    const outlineAlpha = this.getOutlineAlpha();
    outlineColor.setAlpha(outlineAlpha);
    stroke(outlineColor);        // soft outline
    strokeWeight(1.2);
    drawingContext.setLineDash([6, 6]);  // dash length, gap length
    ellipse(0, 0, this.baseRadius * 2.0, this.baseRadius * 2.0);

    this.handleOutlinePercussion(); // snares stay tied to the dashed ring

   // Reset line dash so it does not affect other drawings
   drawingContext.setLineDash([]);
    pop();
  }

  getOutlineAlpha(baseAlpha = 35, highlightAlpha = 220) {
    const points = this.getOutlinePoints();
    for (const pt of points) {
      if (this.isPointOnDash(pt)) {
        return highlightAlpha;
      }
    }
    return baseAlpha;
  }

  getCoreHue() {
    if (this._coreHue === undefined) {
      const baseColor = color(this.palette[0]);
      this._coreHue = hue(baseColor);
    }
    return this._coreHue;
  }

  handleOutlinePercussion() {
    if (!window.audioManager || !window.audioManager.isEnabled?.()) return;
    const touched = this.isOutlineTouched();
    if (touched && !this.outlineActive) {
      window.audioManager.triggerPercussion('snare', { shapeRef: this });
      this.outlineActive = true;
    } else if (!touched && this.outlineActive) {
      this.outlineActive = false;
    }
  }

  isOutlineTouched() {
    const points = this.getOutlinePoints();
    return points.some((pt) => this.isPointOnDash(pt));
  }

  getOutlinePoints() {
    const manager = window.interactionManager;
    if (!manager) return [];
    const points = [];
    const pointer = manager.getPointerPosition();
    if (pointer) points.push(pointer);
    for (const listener of manager.listenerThresholds ?? []) {
      points.push({ x: listener.x, y: listener.y });
    }
    return points;
  }

  isPointOnDash(point) {
    if (!point) return false;
    const { x: localX, y: localY } = this.worldToLocal(point);
    const dx = localX;
    const dy = localY;
    const radial = Math.hypot(dx, dy);
    const radius = this.baseRadius;
    const radialTolerance = 10;
    if (Math.abs(radial - radius) > radialTolerance) return false;

    const dashLength = 6;
    const gapLength = 6;
    const circumference = TWO_PI * radius;
    const dashCount = Math.max(1, Math.floor(circumference / (dashLength + gapLength)));
    const dashAngle = TWO_PI / dashCount;
    const coverageAngle = dashAngle * (dashLength / (dashLength + gapLength));

    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += TWO_PI;
    const angleMod = angle % dashAngle;
    return angleMod <= coverageAngle;
  }

  worldToLocal(point) {
    const dx = point.x - this.x;
    const dy = point.y - this.y;
    const cosR = Math.cos(-this.rotation);
    const sinR = Math.sin(-this.rotation);
    return {
      x: dx * cosR - dy * sinR,
      y: dx * sinR + dy * cosR,
    };
  }
}
