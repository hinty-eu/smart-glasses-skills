---
name: meta-dat-no-eligible-device
description: Debug a Meta DAT Android app that fails with NO_ELIGIBLE_DEVICE or an update-required error.
tags: [meta-display, debugging, android]
runs: 2
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill]
---

My Android app uses the Meta Wearables Device Access Toolkit to show things on Meta Ray-Ban Display. Creating the session keeps failing with NO_ELIGIBLE_DEVICE, and on my colleague's phone it fails with something about UPDATE_REQUIRED instead. The glasses are paired and work fine in the Meta AI app. How do I debug this?
