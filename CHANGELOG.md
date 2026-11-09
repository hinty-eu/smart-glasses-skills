# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.1] - 2026-11-09

Wording and packaging fixes. No vendor facts changed.

### Changed

- Reworded phrases that static skill security scanners read as risky, keeping the meaning of every sentence. For
  example "no approval" (meaning no store review) is now "no store review", and a link to another repository's
  `SKILL.md` now points to its folder. With SkillSpector 2.12.0 (`--no-llm`) the skills score 23, 0, 19 and 13 out
  of 100 (`smart-glasses`, `smart-glasses-live-captions`, `smart-glasses-rokid`, `smart-glasses-vuzix`).
- The platform table in the `smart-glasses` skill is wrapped in `[//]: # "platforms:start"` markers instead of HTML
  comments; `scripts/gen-tables.mjs` accepts both forms.
- Every GitHub Action in the workflows is pinned to a full commit SHA, with its version in a comment.

### Added

- `interface.composerIcon` in `.codex-plugin/plugin.json`, pointing to the existing plugin icon.

## [1.0.0] - 2026-11-09

First public release. Vendor facts were checked against their sources on 2026-11-08 and 2026-11-09. Nothing has
been tested on real glasses yet; every file states how it was verified (`simulator`, `browser`, `compiles` or
`docs-only`).

### Added

- `smart-glasses` skill, the entry point: choosing which glasses to target and what can ship this month, the
  display-text ladder (vendor SDK, web app on the glasses, USB-C display glasses as an external display, mirrored
  phone notification, voice in the ear), small-screen UI, input, audio routing, testing without hardware, publishing
  and troubleshooting by symptom.
- Brand references for Even Realities G2, Meta Ray-Ban Display, Ray-Ban Meta and other audio-only glasses, Rokid
  Glasses, Vuzix Z100, USB-C display glasses, standalone Android glasses, glasses that mirror phone notifications,
  Android XR, MentraOS, Brilliant Labs and Snap Spectacles. Where Even Realities, Meta and Google ship their own
  agent skills, the references point to them instead of repeating them.
- `smart-glasses-live-captions` skill: audio capture, choosing speech-to-text, turning partial and final results into
  lines that fit each display, a latency budget, non-Latin scripts (including the Even G2 limits: one firmware font,
  no custom fonts, image fallback), short hints and voice in the ear.
- `smart-glasses-rokid` skill for Rokid Glasses from an Android phone with the public CXR-L SDK, why CXR-M is not an
  option for apps that run next to Hi Rokid, and the notification fallback.
- `smart-glasses-vuzix` skill for Vuzix Z100 with the Ultralite SDK on Android and iOS: control of the display, text
  layouts, LiveText, notifications and taps.
- Platform data in `data/platforms.json` (CC BY 4.0): 12 platforms, each fact with a source, the date it was checked
  and a confidence level. `scripts/gen-tables.mjs` generates the tables in the README and in the `smart-glasses`
  skill.
- `examples/live-captions`: a Node caption server (demo script, browser microphone, optional Deepgram streaming
  speech-to-text) and four targets that share one WebSocket protocol:
  - web app for glasses browsers, Meta Web Apps and second screens (`browser`);
  - Even Realities G2 plugin, 15 of 15 checks in the official Even Hub simulator 0.9.5 (`simulator`);
  - Android app with Rokid, Vuzix, Meta DAT, USB-C display, notification and speech targets (`compiles`);
  - iOS app with Vuzix, external display, notification and speech targets (`compiles`, built in CI).
- Evaluation suite in `evals/`: 11 realistic developer requests for `claude plugin eval`, each answered with and
  without the skills and graded against a checklist built from official sources, plus 40 prompts for a trigger check.
- Plugin manifests for Claude Code, Codex, Cursor, GitHub Copilot and Gemini CLI, a plugin icon, and
  `AGENTS.md` for agents that do not load skills.
- CI: skill frontmatter, file limits and style checks, table freshness, Claude Code plugin validation, an install
  test with `npx skills`, a secret scan, and Android and iOS builds of the examples.
- `CONTRIBUTING.md`, `SECURITY.md`, `TRADEMARKS.md`, a Code of Conduct (Contributor Covenant 2.1) and issue templates,
  including a hardware verification report.

[Unreleased]: https://github.com/hinty-eu/smart-glasses-skills/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/hinty-eu/smart-glasses-skills/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/hinty-eu/smart-glasses-skills/releases/tag/v1.0.0
