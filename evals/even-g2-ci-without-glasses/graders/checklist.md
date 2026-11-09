---
type: llm
weight: 1
---

You are grading an answer to a developer who wants GitHub Actions to check, on every pull request and without glasses, that an Even Realities G2 app (TypeScript, Vite) starts, shows its first screen and reacts to taps. Grade only what the answer says; do not penalise extra correct detail, hedging, or notes that something is unverified. Facts below were checked against official sources on the date given; the answer does not need to cite them.

## Checklist (1 point each, 0.5 for partial, 0 if missing or wrong)

1. Uses the official simulator, npm package `@evenrealities/evenhub-simulator` (0.9.5, published 2026-09-01; macOS, Linux and Windows). Source: https://hub.evenrealities.com/docs/test/simulator (updated 2026-08-29) and the npm registry, checked 2026-11-08.
2. Starts it against the served app with the automation port, for example `evenhub-simulator http://localhost:5173 --automation-port 9898`, after starting the Vite dev server or a static server for the build. Source: simulator page, section "Headless automation (v0.7.0+)".
3. Drives it through the documented HTTP endpoints: `GET /api/ping`, `GET /api/screenshot/glasses`, `POST /api/input` with actions such as `click`, `double_click`, `up`, `down`, and `GET /api/console` for logs. Source: simulator page above. Half a point if it uses only some of them correctly.
4. Waits before sending input: input is "Silently ignored if no event-capturing container is active", and the docs suggest allowing about 4 s after launch (polling `/api/ping` or the console is fine). Source: simulator page above.
5. Asserts on observable output: the glasses screenshot (lit pixels, an image diff or a size check) and console log lines, before and after a tap. Source: the simulator page's examples. Engineering item; give the point for any concrete assertion.
6. Kills the simulator process at the end, since "The control plane has no shutdown endpoint". Source: simulator page above.
7. Accounts for the simulator being a desktop window app ("a Node + LVGL window"): for example a virtual display such as Xvfb on a Linux runner, or a macOS or Windows runner. The docs give no headless flag, so this part is inference; give the point for any sensible handling. Source: simulator page above.
8. States the limits: the simulator "is not a hardware emulator"; BLE timing, real permissions, background lifecycle and real-device quirks are not reproduced, and headless runs "do not replace Beta Testing before submission". Source: simulator page above.
9. Adds fast unit tests for app logic with a fake or mocked SDK bridge (layout building, event mapping, text fitting), separate from the simulator run. Engineering item.
10. Optionally checks packaging in CI with `evenhub pack app.json dist -o app.ehpk` (the CLI supports `--json` output), and notes that `evenhub login` needs an interactive terminal, so publishing steps need prepared credentials. Sources: https://hub.evenrealities.com/docs/ship/packaging (updated 2026-08-29), Even Hub CLI scripting docs (checked 2026-11-08). Half a point for packaging without the login caveat.
11. Exercises the root-page double tap with `double_click` and checks that the app asks to exit through `shutDownPageContainer(1)`, which store review requires. Source: https://hub.evenrealities.com/docs/ship/app-submission (updated 2026-10-09, checked 2026-11-08).
12. Pins the simulator and SDK versions in `package.json` (or the workflow) so CI is reproducible. Engineering item.

## Critical errors (any one fails the case)

- Says the simulator emulates the hardware fully (BLE, timing, permissions), so no testing on glasses is needed.
- Presents simulator endpoints, CLI commands or flags that do not exist (real endpoints are listed in item 3; real CLI commands include `login`, `init`, `pack`, `qr`, `create`, `upload`, `promote`, `testers`).
- Says the app cannot be tested at all without glasses.
- Proposes connecting to real glasses over Web Bluetooth from CI.

## Scoring

List each item with its score (1, 0.5 or 0) and one short reason, then list any critical error you found. Compute the percent: points earned divided by 12, times 100. Report the percent.

PASS if the percent is at least 70 and no critical error is present.
FAIL if the percent is below 70 or any critical error is present.
