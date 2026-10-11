# Neon Dash

An original browser endless runner inspired by three-lane arcade games. Dodge midnight trains, jump barriers, slide under gates, and collect coins in a procedural neon city.

**Plain HTML, CSS, and JavaScript. No dependencies, downloads, build step, or backend. Ready for GitHub Pages.**

[Play Neon Dash](https://nd.sarvesh.si/)

## Play locally

Open `index.html` in a modern browser. Or serve the folder:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Host on GitHub Pages

1. Create a GitHub repository, such as `neon-dash`.
2. Upload the **contents** of this folder to the repository root. `index.html` must be at the root, alongside `styles.css`, `engine.js`, `game.js`, and `favicon.svg`.
3. Open the repository’s **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the **main** branch and **/ (root)** folder, then click **Save**.
6. Once GitHub finishes deployment, play at `https://YOUR-USERNAME.github.io/neon-dash/`. GitHub displays the exact URL in Pages settings.

All asset paths are relative, so both project Pages and user Pages work. `.nojekyll` tells GitHub to serve these files directly. No GitHub Actions workflow is needed.

### This deployment’s custom domain

The live deployment uses `nd.sarvesh.si`, recorded in `CNAME`. At the DNS provider for `sarvesh.si`, set a **CNAME** record named **nd** with target **sarvesh-kr.github.io** (no protocol or repository path). After DNS resolves and GitHub provisions the certificate, enable **Enforce HTTPS** in the repository’s Pages settings.

When reusing this project for a different repository or domain, remove or replace `CNAME` and update the play link above.

If you prefer Git:

```sh
git init
git add .
git commit -m "Add Neon Dash browser game"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/neon-dash.git
git push -u origin main
```

## Controls

| Action | Keyboard | Mobile |
| --- | --- | --- |
| Move left / right | Left / right arrows or A / D | Swipe left / right or tap arrows |
| Jump a striped barrier | Up arrow, W, or Space | Swipe up or tap up |
| Slide under a pink gate | Down arrow or S | Swipe down or tap down |
| Pause / resume | P or Escape | Pause button |
| Start / restart | Space or the green button | Green button |
| Enter / exit fullscreen | F or the corners button | Corners button |

Trains must be dodged by switching lanes. Jumping will not clear a train. The game pauses automatically when you leave the tab or window.

Tap the corners button at the top right of the game to fill the screen. Fullscreen adapts to a phone’s portrait display or a desktop’s landscape display, with the score, pause, exit, and touch controls kept visible. On supported devices it requests a portrait orientation lock for phones and landscape for desktops. Browsers that cannot lock orientation still adapt to the device’s current orientation.

Native fullscreen hides browser controls where supported. On iPhone Safari and other browsers without element fullscreen, the game fills the browser viewport instead; browser chrome may remain visible. Tap the corners button again or press F to return to the page. Escape exits fullscreen, and pauses the game when outside fullscreen.

### Launch without browser bars

On iPhone or iPad, open the site in **Safari → Share → Add to Home Screen**, leave **Open as Web App** enabled if shown, and tap **Add**. Launch the new **Neon Dash** icon. On Android, use **Chrome or Brave → menu → Install app / Add to Home screen**, then launch that icon. An existing shortcut created before this update may need to be removed and added again.

Home Screen launches automatically fill the app window. The manifest requests fullscreen; iOS uses its standalone web app mode. Browser tabs and the address bar are removed, while device status and gesture indicators remain under OS control. The corners button returns to the page to change settings. The game still needs internet to load; offline caching is not enabled. Best scores may be separate from the regular browser, depending on platform storage behavior.

## Features

- Three difficulty modes: Chill, Classic, and Rush, each with increasing speed and different obstacle spacing.
- Perspective canvas city with buildings, lights, rail tracks, trains, and an animated runner.
- Coin collection and two goals per run: 25 coins and 1,000 meters.
- Score equals whole meters traveled plus 20 points per coin.
- Best score, runner color, and sound preference saved in this browser’s local storage.
- Three runner colors and optional synthesized sound effects. Sound starts muted.
- Responsive layout, touch gestures, mobile buttons, keyboard controls, and instructions.
- Fullscreen play with phone/desktop orientation support and an expanded-view fallback.
- Original procedural artwork. No third-party assets, fonts, APIs, or tracking.

Saved scores are specific to the browser and origin. If browser storage is blocked, the game still works but preferences and scores cannot persist. This is a single-player game with local scores; it does not include an online leaderboard.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Interface, instructions, and accessible controls |
| `styles.css` | Responsive layout and visual design |
| `engine.js` | Game simulation, obstacle generation, and collision detection |
| `game.js` | Canvas rendering, input, audio, and browser storage |
| `fullscreen.js` | Fullscreen, orientation requests, and viewport fallback |
| `manifest.webmanifest` | Home Screen launch mode and app metadata |
| `icons/` | Home Screen and app icons |
| `favicon.svg` | Original lightning icon |
| `tests/engine.test.cjs` | Simulation regression tests |

To change difficulty, edit `MODES` in `engine.js`. To change runner colors, edit `palettes` in `game.js` and the corresponding choices in `index.html`.

## Verification

With Node.js installed, run:

```sh
node tests/engine.test.cjs
node --check engine.js
node --check game.js
```

The tests cover train collisions and lane changes, jumping barriers, sliding gates, coin scoring, pause/resume, movement bounds, speed caps, and safe obstacle generation. Desktop and mobile layouts and the main UI flows were also checked in headless Chromium.

## License

MIT. See `LICENSE`. This project uses its own name and artwork and is not affiliated with Subway Surfers.
