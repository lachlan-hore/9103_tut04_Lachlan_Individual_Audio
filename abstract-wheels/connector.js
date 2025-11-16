class Connector {
  constructor(startWheel, endPos) {
    this.startWheel = startWheel;  // Wheel where the connector begins
    this.endPos = endPos.copy();   // End point of the curve
    this.t = random(TWO_PI);       // Time offset for animation
    // Herman:
    // instead of a fixed colour, pick from the wheel's palette
    this.color = random(this.startWheel.palette);
    // each connector sticks with one effect flavor for the whole session
    // each line gets one effect flavor (flange/delay/phaser/reverb)
    this.effectType = this.pickEffectType();

    this.baseStroke = 3.0;         // base stroke width
    this.strokeAnim = this.baseStroke;
  }

  // Animate the connector's slight wobble
  update() {
    this.t += 0.02;
  }

  // Draw a curved line with a moving control point
  // Betty: Add shadow for every connector. 
  display() {

    // Start and end positions
    let x1 = this.startWheel.x;
    let y1 = this.startWheel.y;
    let x2 = this.endPos.x;
    let y2 = this.endPos.y;

    // Control point with gentle motion
    let cx = (x1 + x2) / 2 + 30 * sin(this.t);
    let cy = (y1 + y2) / 2 + 30 * cos(this.t);

    const manager = window.interactionManager;
    const start = { x: x1, y: y1 };
    const end = { x: x2, y: y2 };
    const control = { x: cx, y: cy };

    const influence = manager
      ? this.sampleThresholdInfluence(manager, start, control, end)
      : 1;
    const alpha = manager
      ? manager.alphaFromInfluence(70, 255, influence)
      : 255;
    const connectorColor = color(this.color);
    connectorColor.setAlpha(alpha);
    const effectLevel = manager
      ? manager.factorFromInfluence(0, 1, influence)
      : influence;

    if (window.audioManager) {
      window.audioManager.accumulateConnectorInfluence(effectLevel, this.effectType);
    }

    stroke(0, alpha * 0.35);
    strokeWeight(7);
    noFill();

    beginShape();
    vertex(x1 + 1, y1 + 1);
    quadraticVertex(cx + 1, cy + 1, x2 + 1, y2 + 1);
    endShape();

    stroke(connectorColor);
    strokeWeight(4);
    noFill();

    beginShape();
    vertex(x1, y1);
    quadraticVertex(cx, cy, x2, y2);
    endShape();

    // Dot at the starting point
    noStroke();
    fill(connectorColor);
    ellipse(x1, y1, 10, 10);

    if (window.DEBUG_CONNECTOR_EFFECTS) {
      // helper label makes it easy to debug which line picked which bus
      fill(255);
      textSize(10);
      textAlign(LEFT, BOTTOM);
      text(this.effectType, x1 + 12, y1 - 8);
    }
  }

  sampleThresholdInfluence(manager, start, control, end) {
    if (!manager) return 0;
    let best = 0;
    const samples = 32;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const pos = this.getQuadraticPoint(start, control, end, t);
      const influence = manager.getThresholdInfluenceAt(pos);
      if (influence > best) best = influence;
      if (best >= 1) break;
    }
    return best;
  }

  getQuadraticPoint(p0, p1, p2, t) {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    return {
      x: uu * p0.x + 2 * u * t * p1.x + tt * p2.x,
      y: uu * p0.y + 2 * u * t * p1.y + tt * p2.y,
    };
  }

  pickEffectType() {
    const effects = ['flange', 'reverb', 'delay', 'phaser'];
    return random(effects);
  }
}

if (typeof window !== 'undefined' && window.DEBUG_CONNECTOR_EFFECTS === undefined) {
  window.DEBUG_CONNECTOR_EFFECTS = false;
}
