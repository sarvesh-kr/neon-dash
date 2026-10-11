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
2. Upload the **contents** of this folder to the repository root. `index.html` must be at the root, alongside `styles.css`, `engine.js`, `game.js`, and the `icons` folder.
3. Open the repository’s **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the **main** branch and **/ (root)** folder, then click **Save**.
6. Once GitHub finishes deployment, play at `https://YOUR-USERNAME.github.io/neon-dash/`. GitHub displays the exact URL in Pages settings.

All asset paths are relative, so both project Pages and user Pages work. `.nojekyll` tells GitHub to serve these files directly. Pages deploys directly from the branch; the included GitHub Actions workflow checks changes without changing deployment settings.

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

Swipes commit once when movement passes a 14–24 CSS-pixel threshold and one axis is clear. Ambiguous diagonals wait for a clearer direction, or use the dominant axis on release. Taps and hold jitter do not move the runner. Only the contact that starts the swipe owns it; extra fingers, cancelled touches, pause/restart, and viewport changes cannot reuse an old gesture. Window listeners preserve edge swipes when pointer capture is unavailable.

Obstacle drawing and collisions share dimensions in `NeonGeometry`. Contacts sweep through the previous and current simulation positions, including lateral movement and jump/crouch height, to avoid crossing thin obstacles between ticks. Gate beams and posts are separate solid parts; lighting and shadows are decorative. The runner uses a forgiving torso core sized to the viewport. Jump rendering uses the same elevation scale as obstacles, and a slide ducks immediately before smoothly standing again.

Contacts resolve in chronological order. Shield/immunity expiry is evaluated at contact time, and a fatal collision freezes the runner and scenery at that point. Pickups reached later cannot count towards a crashed run. Ground-level coins can be missed while jumping over them; the magnet deliberately collects from a wider area.

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
- Coin sparkles, landing dust, shield-break feedback, pickup auras, and a brief crash animation. Cosmetic particles and camera shake respect reduced-motion preferences, including changes made while the page is open.
- Shield and magnet pickups, visible countdowns, a friendlier opening, and collision-specific retry advice.
- Coin collection and two goals per run: 25 coins and 1,000 meters.
- Score equals whole meters traveled plus 20 points per coin.
- Best score, runner color, and sound preference saved in this browser’s local storage. A new record saves immediately at collision, before the retry animation, so navigating away cannot lose it.
- Three runner colors, an original looping synthesized soundtrack, and louder sound effects. Sound defaults to enabled and respects a saved mute preference. Music starts with Play and stops while paused, after a crash, or when the page is hidden. Changing settings before Play does not start the soundtrack. Unsupported or failed audio leaves gameplay usable; enabling sound retries recovery, including rapid mute/unmute during context suspension.
- Responsive layout, immediate swipe gestures without on-screen navigation arrows, keyboard controls, and instructions.
- The play surface suppresses text selection, image dragging, and long-press context menus. Holding still makes no move; each swipe triggers one action. Interrupted gestures reset when paused or restarted.
- Direct expanded game launch, native fullscreen from Play, and Home Screen app support.
- Fixed 120 Hz simulation with interpolated character movement, consistent fast lane changes, a short landing jump buffer, and an airborne downward swipe that lands into a slide.
- Cached scenery, gradients, and collectible sprites; batched track drawing; object sorting only on spawn; reduced distant detail; a bounded canvas resolution; and a 64-particle pool. The animation loop stops when paused or hidden, and after game-over effects settle. Reduced-motion welcome screens stay still. Resuming, restarting, resizing, or changing the runner color redraws as needed.
- Richer neon halos and soft street reflections use a fixed light atlas instead of live blur filters. The road and fixed rails are baked into the district backdrop. Tiny distant halos are culled.
- Centered SVG toolbar icons, keyboard activation of focused buttons, named instructions dialogs, and welcome screens that adapt to the game frame's height.
- Collision checks cover each obstacle's whole body. Lane changes into passing obstacles and slides ending inside gates still collide; successful jump/slide clears count once after passing the hazard.
- Original procedural game artwork and a neon plastic-toy runner mascot for the game logo, browser tab, and Home Screen icons. No third-party runtime assets, fonts, APIs, or tracking.

Saved scores are specific to the browser and origin. If browser storage is blocked, the game still works but preferences and scores cannot persist. This is a single-player game with local scores; it does not include an online leaderboard.

## Memory, storage, and caches

The game writes at most three fixed `localStorage` keys: `neon-dash-best`, `neon-dash-color`, and `neon-dash-sound`. It stores no run history, replay, frame log, or growing collection. Unchanged values do not trigger writes. Invalid or oversized existing game values are replaced with valid defaults; valid scores/preferences and unrelated keys are preserved. The three serialized keys and values use fewer than 160 UTF-16 bytes, excluding browser metadata. Blocked storage and quota errors fall back to memory-only preferences.

Temporary resources are bounded:

| Resource | Budget and cleanup |
| --- | --- |
| Obstacles and collectibles | 128 reusable slots; passed/collected objects return to the pool; restart reuses buffers and resets every flag |
| Contact checks | Reused queue bounded by those 128 slots; reused motion and intersection scratch records |
| Drawing coordinates | 4,096 reusable scratch points; particle targets copy coordinates rather than retaining scratch objects |
| Cosmetic particles | 64 reusable slots; no target-object references |
| Audio | One context and at most 32 connected voices; ended voices disconnect; bursts drop excess effects; hidden/muted pages stop voices and suspend audio |
| Collectible atlas | One 640×256 sheet, about 640 KiB of raw RGBA pixels |
| Lighting atlas | One 512×128 sheet, about 256 KiB of raw RGBA pixels |
| Game canvas and backdrop | Each bounded by the 1.8-million-pixel render budget |

When hidden or leaving a page, the game pauses, cancels animation callbacks, resets particles/toasts, empties both atlases and the backdrop, and reduces the display canvas to one pixel. Returning rebuilds the graphics for the current viewport and preserves the paused run and saved preferences. Visible pause screens retain the textures they still display.

The app does not create Cache Storage, IndexedDB databases, or service-worker caches. Browser-managed HTTP caching helps subsequent loads and is managed by the browser; clearing it on each run would cause unnecessary downloads and would not reclaim the game's live render buffers. Asset version URLs pick up published updates. JavaScript garbage collection and the browser's native/GPU allocators remain under browser control; the game bounds its resources and releases references/buffers rather than trying to force garbage collection during play.

## Security and runtime

The game has no runtime dependencies, account system, server-side code, analytics, or outbound API calls. Its Content Security Policy permits scripts, styles, and images from the same origin and blocks inline scripts, evaluated code, network connections, plugin embeds, forms, frames, and workers. Color swatches use the stylesheet; game-controlled style changes use CSS properties. Overlay titles are constructed as text and elements rather than HTML strings.

Stored colors and difficulty values accept only known own properties, and invalid stored scores fall back to zero. Invalid time steps cannot corrupt the simulation. Browser storage can still be edited by the player; local scores are not authoritative multiplayer or leaderboard records. GitHub Pages supplies HTTPS. Policy directives that require HTTP response headers, such as `frame-ancestors`, are not provided by the HTML meta policy.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Interface, instructions, and accessible controls |
| `styles.css` | Responsive layout and visual design |
| `engine.js` | Game simulation, obstacle generation, and collision detection |
| `input.js` | Single-contact swipe recognition and cancellation |
| `game.js` | Canvas rendering, input, audio, and browser storage |
| `audio.js` | Original looping music, effects, and audio lifecycle |
| `storage.js` | Validated fixed-schema preferences and deduplicated writes |
| `graphics.js` | Fixed light atlas, reflections, and explicit buffer release |
| `character.js` | Original vector character and articulated poses |
| `items.js` | Cached coin and power-up artwork |
| `effects.js` | Fixed-size pool for gameplay particles |
| `fullscreen.js` | Fullscreen, orientation requests, and viewport fallback |
| `manifest.webmanifest` | Home Screen launch mode and app metadata |
| `icons/` | Toy runner mascot, browser favicons, and Home Screen icons |
| `tests/engine.test.cjs` | Simulation regression tests |
| `tests/input.test.cjs` | Gesture thresholds, direction locking, and contact ownership |
| `tests/storage.test.cjs` | Storage bounds, recovery, and write deduplication |
| `tests/effects.test.cjs` | Particle limits and scratch-target independence |
| `tests/audio.test.cjs` | Audio failure recovery, lifecycle, rapid mute/unmute, and voice bounds |
| `scripts/check.mjs` | Unit tests, syntax, local assets, manifest, and security policy checks |
| `.github/workflows/verify.yml` | Automatic release checks on pushes and pull requests |

To change difficulty, edit `MODES` in `engine.js`. To change runner colors, edit `palettes` in `game.js` and the corresponding choices in `index.html`.

## Verification

With Node.js 24 installed, run the release checks from the repository root:

```sh
node scripts/check.mjs
```

The same command runs automatically on pushes to `main` and pull requests. The workflow uses pinned action revisions, read-only repository permissions, and no project secrets or dependencies. It checks JavaScript syntax, same-origin asset paths under a GitHub Pages project URL, unique element IDs, manifest icon dimensions, and the restrictive Content Security Policy.

The 66 unit tests include 43 simulation tests, eight gesture tests, eight audio tests, six storage tests, and one particle test. Simulation coverage includes collisions, movement, coin scoring, pause/resume, difficulty, safe obstacle generation, buffered jumps, airborne slides, depth order, shield protection, magnet collection, pickup expiry/reset, cargo crates, and the opening trail. They also cover late lane-entry collisions, slides expiring inside gates, clear counting, invalid modes/time steps, 30-minute simulated runs in every difficulty, 1,000 restarts reusing the same buffers, recycling flags, and pool saturation. Contact regressions check individual obstacle edges/heights, swept diagonal crossings, disjoint movement paths, gate posts, passed tails, train clipping-plane lifecycle, airborne pickups, chronological shield collection, no post-crash rewards, portrait core clearance, impact-position freezing, and expiry during contact. Gesture tests cover four directions, CSS-pixel thresholds, hold jitter, diagonal deferral/release, one action per contact, extra fingers, cancellation, and invalid coordinates. Storage coverage includes 10,000 changing saves without new keys, unchanged-value write deduplication, valid preference preservation, corrupt/oversized value repair, invalid input rejection, and blocked/quota-failed persistence. Particles verify their targets remain independent of recycled drawing points. Audio tests cover unavailable APIs, partial initialization cleanup, runtime device failures and explicit recovery, the 32-voice limit, ended-node disposal, pause/hide handling, unmuting before suspension settles, and unknown effect names.

Headless Chromium checks cover real swipes before release, long holds, touch cancellation, fixed simulation ticks, music/mute/pause behavior, character jump/crouch poses, pickup timers, all three districts, collision/restart advice, and phone/desktop layouts. The source review also checked SVG centering in expanded and settings views at 320×568, 390×844, 640×320, 844×390, and 1440×900; idle animation suspension; keyboard button activation; paused color changes; page restoration; reduced motion; corrupt/blocked storage; visible goal bars; accessible dialog names; and CSP enforcement.

Production browser checks also exercise immediate record persistence across navigation, live reduced-motion changes, rapid mute/unmute with a real audio context, audio initialization/playback failure recovery, and native fullscreen APIs that throw synchronously.

Additional browser input checks use real multi-touch events, diagonal movement and release, swipes outside viewport/canvas edges, rotation during contact, pointer-capture failure, lost mouse buttons, and a fresh swipe after rotation. They compare the drawn character transform and responsive torso core with collision coordinates at high display density.

Memory checks combined 18 seconds of live rendering, an accelerated one-hour simulation, 200 immediate restarts, and eight hide/restore cycles. The production audit reran this stress test: retained JavaScript heap settled around 1.5 MiB after warmup, active objects stayed within their fixed pool, connected audio voices never exceeded 32, and hidden rendering buffers shrank to one pixel combined. The heap measurement excludes native browser/GPU memory; test instrumentation requested garbage collection only to compare retained allocations, and game code never does so.

Direct Chromium profiling of the earlier cached-lighting update compared the same phone and desktop layouts before and after those rendering changes:

| Layout | Mean frame callback, before → after | 95th-percentile callback, before → after |
| --- | --- | --- |
| Phone | 0.91 → 0.83 ms | 1.9 → 1.5 ms |
| Desktop | 0.78 → 0.78 ms | 1.6 → 1.4 ms |

The contact update was also checked in a clean preview: mean frame callbacks were 0.81 ms on the phone layout and 0.70 ms on desktop (95th percentiles 1.8 ms and 1.1 ms). The production audit measured 1.05 ms mean / 2.9 ms 95th percentile on the phone layout and 1.70 ms / 6.2 ms on desktop. Runs varied under the shared test environment, so these measurements are runtime checks rather than a guaranteed performance improvement.

These are local headless measurements with a 1.8-million-pixel canvas budget, not guarantees for physical devices or total frame/GPU execution times. Native fullscreen success events are simulated because headless Chromium cannot enter OS fullscreen; physical iOS Home Screen launches still need device verification.

## License

MIT. See `LICENSE`. This project uses its own name and artwork and is not affiliated with Subway Surfers.
