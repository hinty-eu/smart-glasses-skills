---
name: even-g2-ci-without-glasses
description: Test an Even Realities G2 app in CI without the glasses.
tags: [even-g2, testing, ci]
runs: 2
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill]
---

We have an Even Realities G2 app (TypeScript, Vite) and a GitHub Actions pipeline. On every pull request I'd like CI to check that the app starts, shows its first screen and reacts to taps, with no glasses attached. How would you set that up? A workflow sketch plus the test script would be great.
