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
| Move left / right | Left / right arrows or A / D | Swipe left / right |
| Jump a barrier or cargo crate | Up arrow, W, or Space | Swipe up |
| Slide under a pink gate | Down arrow or S | Swipe down |
| Pause / resume | P or Escape | Pause button |
| Start / restart | Space or the green button | Green button |
| Enter / exit fullscreen | F or the corners button | Corners button |

Trains must be dodged by switching lanes. Jumping will not clear a train. The game pauses automatically when you leave the tab or window.

Blue **magnets** attract coins from all three lanes for 10 seconds. Mint **shields** protect against one collision for up to 12 seconds, with brief protection after the shield breaks so the same obstacle cannot immediately end the run. Timers appear beneath the score and stop while paused. Every run begins with a short coin trail and an early shield. Further pickups appear along safe routes.

The city changes every 750 meters through **Midnight District**, **Violet Market**, and **Harbor Run**, each with its own sky and neon colors. After a collision, the retry screen explains how to avoid that obstacle and shows successful barrier/gate clears alongside distance, coins, and score.

Every visit opens directly in the expanded game view. Tap **LET’S RUN** to start; that gesture also requests native device fullscreen where supported. The score, music toggle, pause, and exit controls stay visible. Native fullscreen requests portrait orientation for phones and landscape for desktops where orientation locking is available. Other browsers adapt to the current orientation. Tap the corners button to return to the page and change difficulty or runner color.

Native fullscreen hides browser controls where supported. On iPhone Safari and other browsers without element fullscreen, the game fills the browser viewport instead; browser chrome may remain visible. Tap the corners button again or press F to return to the page. Escape exits fullscreen, and pauses the game when outside fullscreen.

### Launch without browser bars

On iPhone or iPad, open the site in **Safari → Share → Add to Home Screen**, leave **Open as Web App** enabled if shown, and tap **Add**. Launch the new **Neon Dash** icon. On Android, use **Chrome or Brave → menu → Install app / Add to Home screen**, then launch that icon. An existing shortcut created before this update may need to be removed and added again.

Home Screen launches automatically fill the app window. The manifest requests fullscreen; iOS uses its standalone web app mode. Browser tabs and the address bar are removed, while device status and gesture indicators remain under OS control. The corners button returns to the page to change settings. The game still needs internet to load; offline caching is not enabled. Best scores may be separate from the regular browser, depending on platform storage behavior.

## Features

- Three difficulty modes: Chill, Classic, and Rush, each with increasing speed and different obstacle spacing.
- Perspective canvas city with three district palettes, buildings, lights, rail tracks, trains, gates, barriers, and cargo crates.
- Original articulated runner with headphones, jacket, backpack, independent limbs, running stride, airborne knee tuck, crouch, landing squash, and lane-change lean.
- Coin sparkles, landing dust, shield-break feedback, pickup auras, and a brief crash animation. Cosmetic particles and camera shake respect reduced-motion preferences.
- Shield and magnet pickups, visible countdowns, a friendlier opening, and collision-specific retry advice.
- Coin collection and two goals per run: 25 coins and 1,000 meters.
- Score equals whole meters traveled plus 20 points per coin.
- Best score, runner color, and sound preference saved in this browser’s local storage.
- Three runner colors, an original looping synthesized soundtrack, and louder sound effects. Sound defaults to enabled, starts after the first user gesture, and respects a saved mute preference. Music stops while paused, after a crash, or when the page is hidden.
- Responsive layout, immediate swipe gestures without on-screen navigation arrows, keyboard controls, and instructions.
- Direct expanded game launch, native fullscreen from Play, and Home Screen app support.
- Fixed 120 Hz simulation with interpolated character movement, consistent fast lane changes, a short landing jump buffer, and an airborne downward swipe that lands into a slide.
- Cached scenery, gradients, and collectible sprites; batched track drawing; object sorting only on spawn; reduced distant detail; a bounded canvas resolution; and a 64-particle pool. Drawing stops when paused or hidden.
- Original procedural artwork. No third-party assets, fonts, APIs, or tracking.

Saved scores are specific to the browser and origin. If browser storage is blocked, the game still works but preferences and scores cannot persist. This is a single-player game with local scores; it does not include an online leaderboard.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Interface, instructions, and accessible controls |
| `styles.css` | Responsive layout and visual design |
| `engine.js` | Game simulation, obstacle generation, and collision detection |
| `game.js` | Canvas rendering, input, audio, and browser storage |
| `audio.js` | Original looping music, effects, and audio lifecycle |
| `character.js` | Original vector character and articulated poses |
| `items.js` | Cached coin and power-up artwork |
| `effects.js` | Fixed-size pool for gameplay particles |
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
node --check audio.js
node --check fullscreen.js
node --check character.js
node --check items.js
node --check effects.js
```

The 18 simulation tests cover collisions, movement, coin scoring, pause/resume, difficulty, safe obstacle generation, buffered jumps, airborne slides, depth order, shield protection, magnet collection, pickup expiry/reset, cargo crates, and the opening trail. Headless Chromium checks also cover real swipes before release, fixed simulation ticks, music and mute/pause behavior, character jump/crouch poses, pickup timers, all three districts, collision/restart advice, and phone/desktop layouts. Native fullscreen success events are simulated because headless Chromium cannot enter OS fullscreen; physical iOS Home Screen launches still need device verification.

## License

MIT. See `LICENSE`. This project uses its own name and artwork and is not affiliated with Subway Surfers.
