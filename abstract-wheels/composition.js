class Composition {
  constructor() {
    this.wheels = [];      // All wheel objects in the scene
    this.connectors = [];  // Curved lines connecting wheels
    this._grid = null;     // hex grid for bead chains
  }

  // Create the initial layout of wheels and connectors
  initLayout() {
    this.wheels = [];
    this.connectors = [];
    // Lachlan: modifided creation of wheels using hexagonal grid
    let grid = new HexGrid(random(130, 180));  // adjust this to control min/max grid radius size
    grid.generate();
    this._grid = grid;

    // Ensure every cell generates stable bead colours
    for (let cell of grid.cells) {
      let palette = random(PALETTES);  // choose per-cell bead palette
      cell.generateBeads(palette);
    }

    // Create a wheel for EVERY visible hex cell
    for (let cell of grid.cells) {
      let palette = random(PALETTES);
      let wheel = new Wheel(cell.x, cell.y, cell.wheelR, palette);
      wheel.initRings();
      this.wheels.push(wheel);
    }

    // Randomly generate connectors between wheels
    for (let k = 0; k < this.wheels.length; k++) {
      if (random() < 0.75) {           // More connectors than before
        let w = this.wheels[k];
        let endX = w.x + random(-110, 110);
        let endY = w.y + random(-110, 110);
        this.connectors.push(
          new Connector(w, createVector(endX, endY))
        );
      }
    }
  }

  // Update animation for all elements
  update() {
    for (let w of this.wheels) w.update();
    for (let c of this.connectors) c.update();
  }

  // Draw wheels, hex bead grid and connectors
  display() {
    // Lachlan: Draw hex bead grid
    if (this._grid) {
      this._grid.display();
    }
    // Betty: Add some texture to background & change the layer wheel and connector.
    for (let i = 0; i < 2; i++) {
      noStroke();
      fill(65, 105, 255, 18);
      ellipse(random(width), random(height), random(80, 160));
    }
    for (let w of this.wheels) w.display();
    for (let c of this.connectors) c.display();
  }
}
