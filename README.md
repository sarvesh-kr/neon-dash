# Neon Dash

An original browser endless runner inspired by three-lane arcade games. Dodge midnight trains, jump barriers, slide under gates, and collect coins in a procedural neon city.

**Plain HTML, CSS, and JavaScript. No dependencies, installation, build step, or backend. Ready for GitHub Pages.**

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

When reusing this project for a different repository or domain, replace `CNAME` and update the play link, canonical URL, social metadata, structured-data URLs, `robots.txt`, and `sitemap.xml` for your domain. The verification script checks their consistency with `CNAME`.

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

Obstacle drawing and collisions share dimensions in `NeonGeometry`. Contacts sweep through the previous and current simulation positions, including lateral movement and jump/crouch height, to avoid crossing thin obstacles between ticks. Gate beams and posts are separate solid parts; lighting and shadows are decorative. The 3D runner uses a fixed forgiving torso core in world coordinates; the Canvas fallback scales its torso core to the viewport. Jump rendering uses the same elevation scale as obstacles, and a slide ducks immediately before smoothly standing again.

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
- Original instanced WebGL2 city with balcony railings, cafe terraces, shop signs, painted murals, rooftop equipment, layered foliage, lanterns, arcade cabinets, and harbor palms. Three district palettes include twilight, a violet neon market, and a bright harbor; animated procedural clouds, atmospheric haze, and sculpted trains complete the scene. The existing Canvas 2D artwork remains available as a compatibility fallback.
- Original articulated toy runner with a beveled head, expressive eyes and blink, molded C-shaped hands, hoodie zipper/drawcords/pockets, jeans stitching, layered backpack with badge/side pockets/buckles, detailed cap and headphones, watch, and sneakers with laces/treads. A shared animation clock drives the welcome turn, speed-sensitive cadence, opposing arm swing, knee tuck, crouch, landing compression, head movement, and backpack/cloth follow-through. Pausing preserves the exact pose. Coins have metallic rims and engraved marks; pickups and hazards keep their shared collision geometry.
- Spinning, bobbing coins and boosts with attached decorations; train wheel spokes follow track travel; lanterns and foliage sway gently. Diamond coin glints, expanding landing dust, drifting spark trails, shield-break feedback, pickup auras, and a brief crash animation. Cosmetic particles and camera shake respect reduced-motion preferences, including changes made while the page is open.
- Shield and magnet pickups, visible countdowns, a friendlier opening, and collision-specific retry advice.
- Coin collection and two goals per run: 25 coins and 1,000 meters.
- Score equals whole meters traveled plus 20 points per coin.
- Best score, runner color, and sound preference saved in this browser’s local storage. A new record saves immediately at collision, before the retry animation, so navigating away cannot lose it.
- Three runner colors, an original looping synthesized soundtrack, and louder sound effects. Sound defaults to enabled and respects a saved mute preference. Music starts with Play and stops while paused, after a crash, or when the page is hidden. Changing settings before Play does not start the soundtrack. Unsupported or failed audio leaves gameplay usable; enabling sound retries recovery, including rapid mute/unmute during context suspension.
- Responsive layout, immediate swipe gestures without on-screen navigation arrows, keyboard controls, and instructions.
- The play surface suppresses text selection, image dragging, and long-press context menus. Holding still makes no move; each swipe triggers one action. Interrupted gestures reset when paused or restarted.
- Direct expanded game launch, native fullscreen from Play, and Home Screen app support.
- Fixed 120 Hz simulation with interpolated character movement, consistent fast lane changes, a short landing jump buffer, and an airborne downward swipe that lands into a slide.
- Fixed instance buffers and local procedural materials. Full quality uses at most 19 draws, including the sky, directional shadow map, quarter-resolution bloom, and filmic composition; Smooth uses nine draws. Auto reduces resolution after sustained slow frames and drops shadows/bloom after two resolution reductions. Smooth and Detailed are selectable in settings. Canvas 2D fallback uses cached scenery, gradients, collectible sprites, and a 64-particle pool. The animation loop stops when paused or hidden, and after game-over effects settle. Reduced-motion welcome screens stay still.
- HDR lighting when float render targets are supported, with a checked LDR path; soft directional shadows, reflective glass, metallic highlights, warm sunlight, hemisphere ambient light, atmospheric fog, subtle silhouettes, edge smoothing, filmic color grading, and restrained bloom. No external texture downloads or rendering library.
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
| Drawing coordinates | 16 reusable 3D projection points or 4,096 fallback scratch points; particles copy coordinates rather than retaining scratch objects |
| 3D instance geometry | Fixed 4,096 cube, 384 cylinder, 384 sphere, 256 rounded-box, 256 torus, 64 beveled-cylinder, and 32 hand-grip slots; 350,208 bytes of reusable CPU instance data |
| 3D GPU resources | One context and 50 owned handles: six programs, twelve shaders, eight vertex arrays, fourteen buffers, six textures, and four framebuffers; deletion/rebuild on hide/restore; no separate render timers |
| 3D glyph atlas | One locally generated 512×256 RGBA sheet (512 KiB); canvas and texture released when hidden |
| 3D render targets | Scene color/depth at the canvas budget; shadow depth at 768² (Auto), 1024² (Detailed), or 1² (Smooth); two bloom targets at one quarter of each dimension, or 1² when disabled. Storage is resized on existing handles, never accumulated. At most about 28 MiB of explicitly allocated HDR texture data in Detailed, excluding the display canvas and browser/driver overhead |
| 3D canvas | Auto: at most 1.2 million pixels, reduced after slow frames; Smooth: 600,000; Detailed: 1.8 million |
| Cosmetic particles | 64 reusable slots; no target-object references |
| Audio | One context and at most 32 connected voices; ended voices disconnect; bursts drop excess effects; hidden/muted pages stop voices and suspend audio |
| Fallback collectible atlas | One 640×256 sheet, about 640 KiB of raw RGBA pixels; unused by 3D rendering |
| Fallback lighting atlas | One 512×128 sheet, about 256 KiB of raw RGBA pixels; unused by 3D rendering |
| Effect canvas / fallback backdrop | 3D uses a transparent effect layer capped at CSS resolution and the 1.8-million-pixel maximum, with no backdrop; fallback canvas and backdrop each use the 1.8-million-pixel budget |

When hidden or leaving a page, the game pauses, cancels animation callbacks, deletes owned 3D GPU resources, resets particles/toasts, empties fallback atlases and the backdrop, and reduces each display canvas to one pixel. Returning rebuilds the graphics for the current viewport and preserves the paused run and saved preferences. Visible pause screens retain the resources they still display. If the GPU context is lost, the run pauses and the Canvas fallback renders it; restoring the context rebuilds the 3D resources and keeps the same paused run. Restoration while hidden delays GPU allocations until the page is visible. Unsupported WebGL2 or failed shader initialization selects the playable fallback.

The app does not create Cache Storage, IndexedDB databases, or service-worker caches. Browser-managed HTTP caching helps subsequent loads and is managed by the browser; clearing it on each run would cause unnecessary downloads and would not reclaim the game's live render buffers. Asset version URLs pick up published updates. JavaScript garbage collection and the browser's native/GPU allocators remain under browser control; the game bounds its resources and releases references/buffers rather than trying to force garbage collection during play.

Browser verification covers jump/crouch/lanes, phone/desktop rotation, all quality modes, real context loss/recovery, five hide/restore cycles, and playable Canvas fallback. Geometry tests verify grounded feet, slide clearance, pickup bounds throughout rotation, and unchanged poses across pause and graphics restoration. Animation tests cover different render frequencies, resume without elapsed-time jumps, restart, reduced motion, and long-run clock bounds. Accelerated repeated-run checks exercise the fixed geometry pools and render-target handles; test-only GPU synchronization prevents the software driver from accumulating a submission backlog. These checks use Chromium's software GPU and verify correctness and bounded ownership, not physical-device FPS. JavaScript heap measurements exclude native/GPU memory.

## Security and runtime

The game has no runtime dependencies, account system, server-side code, analytics, or outbound API calls. Its Content Security Policy permits scripts, styles, and images from the same origin and blocks inline scripts, evaluated code, network connections, plugin embeds, forms, frames, and workers. Color swatches use the stylesheet; game-controlled style changes use CSS properties. Overlay titles are constructed as text and elements rather than HTML strings.

Stored colors and difficulty values accept only known own properties, and invalid stored scores fall back to zero. Invalid time steps cannot corrupt the simulation. Browser storage can still be edited by the player; local scores are not authoritative multiplayer or leaderboard records. GitHub Pages supplies HTTPS. Policy directives that require HTTP response headers, such as `frame-ancestors`, are not provided by the HTML meta policy.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Interface, instructions, and accessible controls |
| `styles.css` | Responsive layout and visual design |
| `engine.js` | Game simulation, obstacle generation, and collision detection |
| `render-pipeline.js` | Bounded shadow map, checked HDR/LDR targets, bloom, edge smoothing, and filmic composition |
| `motion.js` | Reused, bounded animation clock; cadence, pause/restart, welcome turn, blink, and reduced motion |
| `runner-model.js` | Detailed original toy character; reusable hierarchy frames, joints, clothing, face, hands, and shoes |
| `renderer3d.js` | Instanced WebGL2 scene, original models, shaders, projection, quality, and resource lifecycle |
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
| `robots.txt`, `sitemap.xml` | Crawl access and canonical page discovery |
| `noscript.css` | Readable page and instructions when JavaScript is disabled |
| `icons/` | Toy runner mascot, browser favicons, and Home Screen icons |
| `tests/engine.test.cjs` | Simulation regression tests |
| `tests/input.test.cjs` | Gesture thresholds, direction locking, and contact ownership |
| `tests/storage.test.cjs` | Storage bounds, recovery, and write deduplication |
| `tests/effects.test.cjs` | Particle limits and scratch-target independence |
| `tests/audio.test.cjs` | Audio failure recovery, lifecycle, rapid mute/unmute, and voice bounds |
| `tests/motion.test.cjs` | Frame-rate independence, pause/resume, reset, long-run bounds, reduced motion, and invalid inputs |
| `tests/renderer3d.test.cjs` | Graphics fallback, initialization cleanup, resource bounds, adaptive quality, projection, and context restoration |
| `scripts/check.mjs` | Unit tests, syntax, local assets, manifest, and security policy checks |
| `.github/workflows/verify.yml` | Automatic release checks on pushes and pull requests |

To change difficulty, edit `MODES` in `engine.js`. To change runner colors, edit `palettes` in `game.js` and the corresponding choices in `index.html`.

## Verification

With Node.js 24 installed, run the release checks from the repository root:

```sh
node scripts/check.mjs
```

The same command runs automatically on pushes to `main` and pull requests. SEO checks also validate the canonical origin, metadata, share-image dimensions, structured-data markers, and crawler assets. The workflow uses pinned action revisions, read-only repository permissions, and no project secrets or dependencies. It checks JavaScript syntax, same-origin asset paths under a GitHub Pages project URL, unique element IDs, manifest icon dimensions, and the restrictive Content Security Policy.

The 89 unit tests include 43 simulation tests, eight gesture tests, eight audio tests, sixteen renderer lifecycle tests and seven animation-clock tests, six storage tests, and one particle test. Simulation coverage includes collisions, movement, coin scoring, pause/resume, difficulty, safe obstacle generation, buffered jumps, airborne slides, depth order, shield protection, magnet collection, pickup expiry/reset, cargo crates, and the opening trail. They also cover late lane-entry collisions, slides expiring inside gates, clear counting, invalid modes/time steps, 30-minute simulated runs in every difficulty, 1,000 restarts reusing the same buffers, recycling flags, and pool saturation. Contact regressions check individual obstacle edges/heights, swept diagonal crossings, disjoint movement paths, gate posts, passed tails, train clipping-plane lifecycle, airborne pickups, chronological shield collection, no post-crash rewards, portrait core clearance, impact-position freezing, and expiry during contact. Gesture tests cover four directions, CSS-pixel thresholds, hold jitter, diagonal deferral/release, one action per contact, extra fingers, cancellation, and invalid coordinates. Storage coverage includes 10,000 changing saves without new keys, unchanged-value write deduplication, valid preference preservation, corrupt/oversized value repair, invalid input rejection, and blocked/quota-failed persistence. Particles verify their targets remain independent of recycled drawing points. Audio tests cover unavailable APIs, partial initialization cleanup, runtime device failures and explicit recovery, the 32-voice limit, ended-node disposal, pause/hide handling, unmuting before suspension settles, and unknown effect names.

Headless Chromium checks cover real swipes before release, long holds, touch cancellation, fixed simulation ticks, music/mute/pause behavior, character jump/crouch poses, pickup timers, all three districts, collision/restart advice, and phone/desktop layouts. The source review also checked SVG centering in expanded and settings views at 320×568, 390×844, 640×320, 844×390, and 1440×900; idle animation suspension; keyboard button activation; paused color changes; page restoration; reduced motion; corrupt/blocked storage; visible goal bars; accessible dialog names; and CSP enforcement.

Production browser checks also exercise immediate record persistence across navigation, live reduced-motion changes, rapid mute/unmute with a real audio context, audio initialization/playback failure recovery, and native fullscreen APIs that throw synchronously.

Additional browser input checks use real multi-touch events, diagonal movement and release, swipes outside viewport/canvas edges, rotation during contact, pointer-capture failure, lost mouse buttons, and a fresh swipe after rotation. They compare the drawn character transform and responsive torso core with collision coordinates at high display density.

Before the 3D upgrade, memory checks combined 18 seconds of live rendering, an accelerated one-hour simulation, 200 immediate restarts, and eight hide/restore cycles. The production audit reran this stress test: retained JavaScript heap settled around 1.5 MiB after warmup, active objects stayed within their fixed pool, connected audio voices never exceeded 32, and hidden rendering buffers shrank to one pixel combined. The heap measurement excludes native browser/GPU memory; test instrumentation requested garbage collection only to compare retained allocations, and game code never does so.

Historical Canvas 2D Chromium profiling of the cached-lighting update compared the same phone and desktop layouts before and after those rendering changes:

| Layout | Mean frame callback, before → after | 95th-percentile callback, before → after |
| --- | --- | --- |
| Phone | 0.91 → 0.83 ms | 1.9 → 1.5 ms |
| Desktop | 0.78 → 0.78 ms | 1.6 → 1.4 ms |

The contact update was also checked in a clean preview: mean frame callbacks were 0.81 ms on the phone layout and 0.70 ms on desktop (95th percentiles 1.8 ms and 1.1 ms). The production audit measured 1.05 ms mean / 2.9 ms 95th percentile on the phone layout and 1.70 ms / 6.2 ms on desktop. Runs varied under the shared test environment, so these measurements are runtime checks rather than a guaranteed performance improvement.

These are local headless measurements with a 1.8-million-pixel canvas budget, not guarantees for physical devices or total frame/GPU execution times. Native fullscreen success events are simulated because headless Chromium cannot enter OS fullscreen; physical iOS Home Screen launches still need device verification.

## Search and sharing

The homepage targets the game name and free browser endless-runner searches with a descriptive title, description, primary heading, and player-facing instructions. The canonical URL is `https://nd.sarvesh.si/`, including when the page opens with a Home Screen launch parameter or via its GitHub Pages address. The sitemap lists this single public page; it does not list assets, duplicate query URLs, or fabricated pages. Its `lastmod` should change only when the page's content changes.

`robots.txt` permits crawling and advertises the sitemap. The page includes `WebSite` and `VideoGame` microdata in its initial HTML. Microdata preserves the restrictive script policy and describes the actual game; there are no invented reviews, ratings, or guarantees of rich results. Controls, difficulty descriptions, and frequently asked questions are readable in the settings view after exiting the expanded game. With JavaScript disabled, a small fallback stylesheet restores normal scrolling and makes the game information accessible.

Open Graph and Twitter card metadata reference a 1200×630 PNG preview made from the original mascot and actual game rendering. This image is for link previews and is not downloaded by normal gameplay. The preview is generated from the current game rendering. The 3D upgrade preserves same-origin assets, metadata, and static hosting.

After publication, a verified owner can submit `https://nd.sarvesh.si/sitemap.xml` in [Google Search Console](https://search.google.com/search-console/) and Bing Webmaster Tools, then monitor indexing and search queries. Search Console verification/submission is not configured in this repository; do not invent verification tokens or include credentials in public files. Sitemaps and metadata help discovery, but search engines decide indexing, ranking, snippets, and recrawl timing.

## License

MIT. See `LICENSE`. This project uses its own name and artwork and is not affiliated with Subway Surfers.
