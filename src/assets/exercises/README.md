# Exercise SVGs

Drop a small SVG here and Pulse will use it automatically for that exercise.

## How it works

1. Each exercise has an `imageKey` (e.g. `bench-press`, `squat`, `curl`) in `src/data/exercises.ts` / `src/data/plans.ts`
2. If a file named `{imageKey}.svg` exists in this folder, `ExerciseImage` shows it
3. If not, the built-in line icon for that key is used

## Bundled icons

Icons were adapted from open packs (paths only; colors tinted per muscle group):

| Source | License | Used for |
| --- | --- | --- |
| [Material Design Icons](https://pictogrammers.com/library/mdi/) (`@iconify-json/mdi`) | Apache 2.0 | Most lifts, cardio, yoga poses |
| [Game Icons](https://game-icons.net/) (`@iconify-json/game-icons`) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | Pull-up, pulldown, OHP, RDL, face-pull |
| [Health Icons](https://healthicons.org/) (`@iconify-json/healthicons`) | CC0 / MIT | Core + rower |

Game Icons attribution: icons by Lorc / Delapouite / contributors via game-icons.net.

## Tips

- Prefer **simple** SVGs (viewBox `0 0 24 24` or `0 0 512 512`)
- Keep file size small — they show as ~48–112px tiles
- Use a solid fill that reads on the colored muscle background
- No React changes needed when adding a file for an existing `imageKey`
