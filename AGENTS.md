# Repository Guidelines

## Project Structure & Module Organization
- Suggested layout for a mobile browser game:
  - `src/engine/`, `src/game/`, `src/ui/`: TypeScript modules.
  - `public/`: static assets (`index.html`, icons, `<meta viewport>`).
  - `public/assets/`: images (WebP/AVIF), audio (AAC/OPUS), sprite sheets.
  - `tests/`: unit tests mirroring `src/` paths; `e2e/` for Playwright.
  - `scripts/`: build, asset pipelines, CI helpers.

## Build, Test, and Development Commands
- Node + Vite recommended:
  - `npm ci`: install exact deps.
  - `npm run dev`: local server with HMR.
  - `npm run build`: production bundle (code split, minify).
  - `npm test`: unit tests (Vitest/Jest).
  - `npm run e2e`: Playwright tests on mobile viewports.
  - `npm run lint` / `npm run format`: ESLint/Prettier.
  - Deploy to GitHub Pages: set `REPO_URL` and (optional) `GH_TOKEN`, then run `./scripts/deploy.sh`.
    Example: `REPO_URL=https://github.com/<user>/<repo>.git GH_TOKEN=... ./scripts/deploy.sh`

## Coding Style & Naming Conventions
- TypeScript first; 2-space indent; max line 100.
- Names: `camelCase` for vars/functions, `PascalCase` for classes/types, `kebab-case` for files.
- Keep render logic pure; isolate state in small stores; no side effects in tight loops.
- Commit only formatted, lint-clean code (Prettier + ESLint with `typescript-eslint`).

## Performance & Mobile UX Best Practices
- Target 60 fps (≤16.7 ms/frame); use `requestAnimationFrame` and avoid long tasks.
- Use `PointerEvent`s with passive listeners; set `touch-action` to remove 300 ms delay.
- Define `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- Prefer CSS transforms/opacity for animations; minimize layout thrash; batch reads/writes.
- Audio: initialize `AudioContext` on first user gesture to satisfy autoplay policies.
- Assets: compress images (WebP/AVIF), sprite sheets or texture atlases; lazy load levels.
- Use Service Worker for offline/cache; keep a small performance budget (JS < 200KB gzipped initially).
- Consider OffscreenCanvas/WebGL; progressively enhance to WebGPU where supported.

## Testing Guidelines
- Unit: Vitest/Jest; files `*.spec.ts` adjacent to source.
- E2E: Playwright with iPhone/Android emulation; test input latency and orientation.
- Aim ≥80% coverage on new/changed lines.

## Commit & Pull Request Guidelines
- Conventional Commits (`feat:`, `fix:`, `perf:`, `chore:`); ≤72-char subject.
- PRs: describe gameplay change, performance impact, and test evidence (screens, metrics).
- Link issues (`Closes #123`); keep PRs small and focused.

## Security & Configuration Tips
- No secrets in repo; use `.env.example` and local `.env`.
- Pass tokens via environment variables; never commit them. Prefer transient headers (http.extraheader) when pushing.
- Respect platform privacy (no unexpected sensors); request permissions lazily.
