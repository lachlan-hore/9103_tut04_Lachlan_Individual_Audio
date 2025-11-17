# Individual Project

## Audio Feature

1. **How to use it**
   - Click the **Start Audio** button in the centre of the canvas.
   - Move the cursor around the wheels: dotted rings trigger kicks, line rings trigger hats, dashed outlines trigger snares, the normal beads emit tonal synths and the special beads trigger a sound effect looping.
   - Click anywhere to drop a listener: each listener behaves like a second cursor with its own trigger radius. Shift‑click (or right click) removes a listener.
   - Use the threshold slider (top‑left) to resize the active radius. The mixer panel (bottom‑right) balances Synth/Kick/Hat/Snare/SFX plus the FX master and also exposes individual FLANGE/REVERB/DELAY/PHASER sliders so you can adjust strength of each connector effect. Every panel has its own +/- toggle in the top-right corner so you can hide or show it as needed. Press **H** to toggle debug labels that show which effect each connector is driving.

2. **Approach**
   - I chose **audio** as the feature for my individual contribution. Every interaction on the original artwork produces or changes the sound.
   - Properties animated: alpha/size of beads, ring highlights, dashed outlines, connector lightness and audio parameters (gain/waveform/effect sends).
   - Technical summary:
     - `audio.js` starts the single Web Audio context, preloads manifests for Kicks/Hats/Snares/SFX and assigns each visual element a persistent voice (oscillator or buffer source). Waves are chosen per shape and their hue maps to octaves. Special beads/corners host looping SFX routed through the `sfx` bus.
     - Connectors sample their distance from any active threshold, brighten visually and feed the same influence into a random effect chain (flange/reverb/delay/phaser). The master audio graph splits into dry + four parallel FX buses, each with a smooth wet gain.
     - `events.js` owns listener placement/removal, the mouse “pointer suppression” when listeners are dropped and exposes `getThresholdInfluenceAt()`/`factorFromInfluence()` so every script reads the same influence value.
     - Visual scripts now consume those hooks: `hexBeads.js` tints beads/dots based on audio level (special beads blend toward their loop colour), `ring.js` merges mouse + listener points before deciding drum hits and `wheel.js` only fires snares when the dashed outline lines up with a cursor/listener centre.
     - Connectors store their randomly assigned effect type and if the user presses **H**, labels it above the line so users can see which FX bus they’re feeding.
     - `sketch.js` handles the Start Audio gate (autoplay compliance), the top-left threshold card, the bottom-right mixer (Synth/Kick/Hat/Snare/SFX buses plus individual flange/reverb/delay/phaser sliders), the instruction card, the connector-effect debug toggle and per-frame hooks (`beginFrame`/`applyConnectorEffects`) so visual + audio layers stay synced.
     - External techniques/sources: All drum one-shots (kicks/hats/snares) come from the royalty-free library bundled with FL Studio, so there are no licensing issues and I chose to use them as I already had them installed. A lot of what I used comes from past projects and things I already know, but I frequently referenced the [Web Audio API docs](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) for help understanding node behavior. I first learned to code in high school and have been largely self taught since, so for me this course is mainly a refresher and helped to revisit collaborative workflows like GitHub, while giving me projects to work on and making my CV/portfolio look better.

### Changes

1. **GUI refactor + new module**
   - All UI creation (threshold card, start-audio button, mixer, instructions, overlay rendering) now lives in `GUI.js`, keeping `sketch.js` lightweight. The new controller also adds panel show/hide logic so every card collapses to a consistent +/- tile.

2. **Threshold control tweaks**
   - Default mouse radius dropped to 15px so fine-detail interactions are easier right away. The slider + label sit higher.

3. **Cursor output toggle**
   - Pressing Space now toggles mouse-triggered audio. When disabled, the GUI changes to “Cursor output: OFF”, the threshold ring turns red and the detection code ignores the cursor while listeners continue to behave normally. Re-enabling Space immediately restores full behaviour.



# Group Project Readme

## 9103_tut04_group_G

PAN：Code Architecture Overview

This project uses object-oriented structure to allow each team member to modify or extend a different part without conflicts.

1. Composition
Manages the entire scene:

Generates wheel positions in a loose grid

Creates wheels + connectors

Calls update() and display() for all elements

Ideal for teammates working on layout or global animations

2. Wheel
Represents each circular shape:

Holds multiple rings

Has rotation animation

Manages its own color palette

Ideal for teammates working on circle behavior or animations

3. Ring
One layer of the wheel:

Types: "solid", "dots", "rays"

Procedurally generates patterns

Can be easily extended with new pattern types

Ideal for teammates designing new textures or visual styles

4. Connector
Curved, animated lines between circles:

Quadratic bezier curve with slight noise animation

Ideal for teammates adding motion, effects, or interaction

5. sketch.js
Main p5.js file:

Creates canvas

Manages draw loop

Calls Composition methods

Should stay simple so the framework stays stable

6. constants.js
Stores:

Color palettes

Background color

(You can also add more style presets here later)

7. HexGrid & HexCell  
Procedural bead-based animation system arranged in a hexagonal tiling.

Creates a dynamic layer of animated “beads” that move, pulse, and
interact across a large hex-grid structure.

Ideal for teammates who want to experiment with complex motion,
pattern generation, or secondary ambient animation layers.

• HexGrid  
  - Generates a rotated hexagonal lattice across the canvas  
  - Creates and stores all HexCell objects  
  - Handles overall grid offsets and density  
  - Manages the animation timing shared across cells  

• HexCell  
  - Computes hexagon vertices and edge geometry  
  - Procedurally generates bead positions along edges  
  - Adds special beads and corner beads with unique animations  
  - Controls local flow animation using sine-based offsets  
  - Each bead supports wobble, pulse, drift, scale, and noise effects  

• Animation Logic  
  - Uses sine waves for continuous motion  
  - Adds tangential and normal offsets for organic movement  
  - Special beads have layered animations (stroke, core, dot)  
  - Corner beads synchronized using a shared map so overlapping points are drawn once  


Herman's Change:

1. Conversion of Solid Rings into Dashed Rings

I modified the solid ring type so that it is rendered using a dashed stroke instead of a continuous line.
This provides a segmented, hand-drawn appearance that better matches the stylistic qualities of the reference artwork.

2. Dashed Outer Outline on Wheels

I changed the outer boundary of each wheel from a solid circle to a clean, evenly spaced dashed outline.
This subtle adjustment enhances the overall visual readability of each wheel without altering its core structure.

3. Added a Centre Core Circle in Each Wheel

I added a small palette-based centre circle to each wheel, creating a more defined focal point and improving resemblance to the reference artwork’s concentric visual motifs.
This is a purely aesthetic addition that does not modify the wheel’s geometry.

4. Added a Dark-Tone Colour to Each Palette

I expanded each colour palette by adding one deep-tone colour to strengthen contrast and unify the appearance of shadows, outlines, and darker ring elements.
This maintains colour harmony while giving the codebase more flexibility when rendering dark accents.

5. Connector Colour Adjustment

I updated the connector colour to be selected from the wheel’s palette rather than using a fixed value, ensuring better colour correspondence between wheels and their connecting lines.



Betty's change:

1. Add some texture to the background

I added some light-blue ellipses to the background so that it could be more complicated and fit with original art style better.

2. Change the layer of wheels and connectors

I found out the connectors were above the wheels in the original paint so I simply changed the order of display. 

3. Add shadow for each connectors

I created another darker and wider connectors under the original connectors to represent the shadow. Also, I changed the positions of the new connectors slightly so that they would only show on one side of the connector. 


Lachlan's Change:

1. Created new hexBeads.js script

2. Updated wheel placement to line up with the new hex grid

3. Added bead chains along each edge

4. Gave the beads a subtle flowing animation

5. Force outer ring of each wheel to be solid
