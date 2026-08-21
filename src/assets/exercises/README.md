# Exercise media (SVG + video)

Drop files here and Pulse picks them up by `imageKey` (see `src/data/exercises.ts` / `src/data/plans.ts`).

## Files

| File | Used when |
| --- | --- |
| `{imageKey}.svg` | Icon / poster fallback |
| `{imageKey}.webm` | Preferred looping demo (smaller) |
| `{imageKey}.mp4` | Demo if no `.webm` |

Priority in the UI: **video (when enabled) → SVG → built-in stroke icon**.

List tiles (`size="sm"`) keep the SVG by default for performance. Pass `preferVideo` to force a demo, or use `md` / `lg`.

## Offline

Yes — demos are part of the Vite build and **precached by the service worker** (Workbox includes `webm` / `mp4`). After the PWA installs/updates once online, clips play offline.

`ExerciseImage` loads each clip as a full blob (not streaming ranges), which is reliable for short files from Cache Storage.

## Size guidelines

- Aim for **2–4s**, muted, looping form demos
- Target **~100–400 KB** per clip (WebM VP9/AV1 or H.264 MP4 at ~360p)
- 30 clips × 300 KB ≈ **~9 MB** — fine for a workout PWA; avoid multi‑MB HD

Example encode:

```bash
ffmpeg -i source.mp4 -an -vf "scale=360:-2" -c:v libvpx-vp9 -b:v 250k -t 3 bench-press.webm
```

## Bundled demos (`.mp4`)

Short looping clips were generated from start/end stills in
[yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db) (**Unlicense** / public domain).
Each clip crossfades the two pose photos (~1.8s, muted, ~10–20 KB). `burpee` uses Mountain Climbers (closest match in that dataset).

## Bundled SVG icons

Icons were adapted from open packs (paths only; colors tinted per muscle group):

| Source | License | Used for |
| --- | --- | --- |
| [Material Design Icons](https://pictogrammers.com/library/mdi/) | Apache 2.0 | Most lifts, cardio, yoga poses |
| [Game Icons](https://game-icons.net/) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | Pull-up, pulldown, OHP, RDL, face-pull |
| [Health Icons](https://healthicons.org/) | CC0 / MIT | Core + rower |

Game Icons attribution: icons by Lorc / Delapouite / contributors via game-icons.net.

## Tips

- Prefer simple SVGs (`0 0 24 24` or `0 0 512 512`)
- Solid fill that reads on the muscle-colored tile
- No React changes needed when adding a file for an existing `imageKey`
