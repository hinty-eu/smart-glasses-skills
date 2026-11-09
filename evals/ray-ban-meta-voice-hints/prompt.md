---
name: ray-ban-meta-voice-hints
description: Read short hints aloud on Ray-Ban Meta (no display) from an Android app that keeps recording with the phone mic.
tags: [meta-audio-glasses, audio, android]
runs: 2
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill]
---

I have an Android app that listens to a conversation through the phone's microphone and generates short hints with an LLM. My users wear Ray-Ban Meta glasses, and I want the hints read aloud through the glasses while the phone keeps recording. How do I do this without breaking the recording?
