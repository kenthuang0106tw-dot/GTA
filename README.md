# Open City 3D

A Three.js first-person open city action prototype with local engine files, low-poly models, local textures, procedural audio, traffic, pedestrians, and police pursuit.

## Play On GitHub Pages

Open:

```text
https://kenthuang0106tw-dot.github.io/GTA/
```

## Play Locally

From this folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\dev-server.ps1
```

Then open:

```text
http://127.0.0.1:8787/
```

## What Changed

- Three.js is now vendored in `vendor/three.module.js`; the game no longer depends on jsDelivr.
- Game code is split into `src/main.js` and `src/styles.css`.
- Local texture assets live in `assets/textures/`.
- Forward/backward movement is fixed for walking and driving.
- The city now uses textured roads, sidewalks, building facades, grass, a sky dome, fog, skyline, lighting, and shadows.
- Cars are multi-part low-poly models with wheels, bumpers, lights, cabins, police sirens, and wheel animation.
- Pedestrians are multi-part low-poly characters with walking animation and panic behavior.
- Audio is generated with WebAudio for shots, melee hits, explosions, and engine hum.
- Driving switches to a dashboard/steering-wheel overlay.

## Controls

- Click the game: lock mouse look
- `WASD` or arrow keys: move / drive
- Mouse: look around
- Left click: shoot
- `F`: melee attack
- `E`: enter / exit vehicle
- `Shift`: sprint
- `Space`: brake / boost while driving
- `R`: reload

## Mobile Controls

- Left stick: move / steer
- Right stick: look
- `HIT`: melee
- `FIRE`: shoot
- `CAR`: enter / exit vehicle
- `GAS`: accelerate
