---
name: rokid-text-from-server
description: Show text that arrives from a server on Rokid Glasses, from an Android app.
tags: [rokid, display-text]
runs: 2
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill]
---

My Android app gets short text updates from our server over a WebSocket, a few per second at most (status lines, short instructions). I'd like that text to appear on my users' Rokid Glasses. What's the right way to do this, and what does the code look like in Kotlin?
