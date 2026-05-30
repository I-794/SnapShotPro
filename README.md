# SnapShot-Pro v7 (Vite)

Modular SnapShot-Pro, set up for Vite and Vercel deployment. The Pro Editor is
the single app — `index.html` is the entry, served at `/` (Vercel auto-detects
Vite and serves the `dist/` build). v7 adds a visual overhaul (glassmorphism,
micro-animations), element animation with GIF export, advanced AI features
(auto-enhance, smart crop, style transfer), and sharing/collaboration tools
(share links, embed codes, QR codes, expanded social presets).

## Develop

```bash
npm install
npm run dev
```

Opens at http://localhost:5173

## Build

```bash
npm run build
```

Outputs to `dist/`.

## Project layout

```
snapshot-pro/
├── index.html              entry HTML (just the shell + script tag)
├── package.json
├── vite.config.js
├── src/
│   ├── main.js             app entry, wires everything up
│   ├── styles.css          all styles (was inline)
│   ├── state/
│   │   ├── state.js        global app state object
│   │   ├── history.js      undo/redo stack
│   │   └── presets.js      gradient/shadow/size/mesh/tilt presets
│   ├── render/
│   │   ├── render.js       main render() entry point
│   │   ├── background.js   gradient/mesh/solid/transparent bg
│   │   ├── shadow.js       drawShadow
│   │   ├── frames.js       macOS, Windows, iPhone, browser frames
│   │   ├── annotations.js  arrow/rect/circle/number/sticker
│   │   ├── redactions.js   blur/pixelate boxes
│   │   ├── spotlight.js    spotlight effect
│   │   ├── overlays.js     text overlay + watermark
│   │   ├── autolayout.js   multi-image grid/row/col
│   │   └── scenes.js       laptop/phone/tablet mockup scenes
│   ├── features/
│   │   ├── upload.js       file/drag/paste/SVG handling
│   │   ├── canvas-tools.js mouse handlers for drawing tools
│   │   ├── layers.js       layers panel
│   │   ├── palette.js      Cmd+K command palette
│   │   ├── zoom-pan.js     viewport zoom/pan/minimap
│   │   ├── templates.js    save/load templates from localStorage
│   │   └── export.js       PNG/JPEG/WebP/clipboard/HTML
│   ├── ui/
│   │   ├── elements.js     all document.getElementById refs in one place
│   │   ├── theme.js        dark/light theme
│   │   ├── notification.js toast popups
│   │   └── bindings.js     attach sidebar control listeners
│   └── utils/
│       ├── color.js        hex/rgba helpers
│       ├── geometry.js     hit testing, fitContain, roundRectPath
│       └── dom.js          escapeHTML, etc
```

## Deploy

See DEPLOY.md.
