# Evaluation

This folder measures what the skills add: the same realistic developer requests are answered once with this plugin
loaded and once without it, and a separate judge scores both answers against a checklist built from official vendor
sources. It also holds a trigger check for the skill descriptions.

Last updated: 2026-11-09.

## Layout

```
evals/
  <case-id>/prompt.md              the developer's request (body) and run settings (frontmatter)
  <case-id>/graders/checklist.md   llm grader: scored checklist, critical errors, pass rule
  <case-id>/graders/skill-fired.md tool_used grader: did one of our skills load (indicator, not scored)
  triggers.json                    40 one-line prompts for the trigger check
  run-triggers.mjs                 runs the trigger check
  results/                         written by the tools (reserved name)
```

The cases use the `prompt.md` + `graders/*.md` layout of `claude plugin eval`
([docs](https://code.claude.com/docs/en/plugin-evals.md)).

| Case | What it asks | Main things it checks |
|---|---|---|
| `even-g2-live-captions` | Live captions on Even G2, architecture and code | Even Hub plugin model, page lifecycle, PCM capture, no built-in STT, network whitelist, simulator limits |
| `rokid-text-from-server` | Server text on Rokid Glasses from Android | CXR-L via Rokid's companion app, `CUSTOM_VIEW` updates, session states, no taps to phone apps |
| `vuzix-z100-ios-captions` | Live captions on Vuzix Z100 from iPhone | UltraliteSDK linking and control, no mic on the glasses, Speech framework limits, background modes |
| `meta-display-publish-next-month` | Meta Ray-Ban Display text, launch to everyone next month | Publishing not open, Beta channel, MFi block on iOS, Web Apps preview, countries |
| `meta-dat-no-eligible-device` | Debug `NO_ELIGIBLE_DEVICE` and an update error | Selector meaning, `BLUETOOTH_SCAN`, `DAT_APP_ON_THE_GLASSES_UPDATE_REQUIRED`, versions, Developer Mode |
| `choose-glasses-teleprompter` | Which glasses for a public iPhone teleprompter this month | What can ship today per brand, iPhone external display rules, risks stated |
| `ray-ban-meta-voice-hints` | Spoken hints on Ray-Ban Meta while the phone records | A2DP vs HFP, phone mic routing, no SCO, TTS queue and focus, foreground service |
| `even-g2-arabic` | Arabic text on Even G2 | Missing glyphs, no custom fonts, image-container workaround and its limits |
| `even-g2-ci-without-glasses` | G2 app tests in CI without glasses | Simulator automation API, startup wait, cleanup, what the simulator does not emulate |
| `double-tap-every-brand` | Double tap = repeat on four brands | G2 root-page exit rule, Vuzix tap count, Rokid glasses-side events, Meta has no double tap |
| `xreal-subtitles-android` | Subtitles on XREAL One from Android, then iPhone | `Presentation`, display listener, no XREAL SDK needed, iPhone models, external display scene, iOS 27 |

## How the evaluation works

**Two arms.** `claude plugin eval` runs every case in a fresh, isolated, non-interactive session: once with this
plugin loaded (WITH) and once with no plugin (W/OUT). Nothing personal loads in either arm: no user settings,
`CLAUDE.md`, memory, other plugins or personal skills. Both arms get the same prompt and the same tools
(`Read`, `Glob`, `Grep`, `Skill`; no shell, no file writes, no web unless you grant them). The difference between
the two scores (Δ) is what the skills contributed.

**Grounded checklists.** Every factual checklist item was checked on 2026-11-08 or 2026-11-09 against an official
source (vendor docs, SDK typings, vendor repositories, Apple and Android references; a few community or press
sources are marked as such) and carries its URL and date. The items are written from those sources, not from the
skill text, so a high score means the answer is right, not that it repeats our wording. Engineering and judgement
items are marked as such. Each checklist also lists critical errors (for example claiming Meta DAT apps can be
published to all users today, inventing API names, claiming Even G2 has a speaker); any one of them fails the run.

**Blind grading.** The judge sees only the agent's final reply (`focus: last_message`, the default). It does not see
which arm produced it, the transcript, or the skill files. It scores each item 1, 0.5 or 0, reports the percent,
and votes PASS when the percent is at least 70 and no critical error is present. Each verdict is the majority of
three judge votes.

**Scores.** A run scores 1 when `checklist.md` passes and 0 when it fails (`skill-fired.md` is shown as a
"plugin-fired indicator" in the WITH arm and does not count). Each case runs twice per arm (`runs: 2`), so a case
scores 0, 0.5 or 1. With `--threshold 0.8` a case passes only if both WITH runs pass. Read the judge's per-item
percent in the report for finer detail than pass or fail.

**Record with every result:** date, agent model (`--model`), judge model (`--judge-model`), `claude --version`,
the repository commit, and the cost the run reported. Without the model names the numbers cannot be compared.

## Running the cases

From the repository root:

```bash
claude plugin eval . --trust-plugin --ablation with-without --threshold 0.8 --no-publish --max-cost-usd 2
```

Notes:
- The full suite is 11 cases x 2 runs x 2 arms = 44 agent runs of up to 30 turns. A USD 2 ceiling usually stops
  before the end and the command exits 2 with partial results. For a complete run raise `--max-cost-usd`, use a
  cheaper `--model`, or run cases one at a time with `--case <name>`.
- Pin both models so runs are comparable, for example `--model sonnet --judge-model sonnet`. The default judge is
  the background-task model, which can be too weak for 11 to 13 item checklists; Sonnet is the recommended judge.
  Format check on 2026-11-09 (`even-g2-arabic`, one run per arm, agent Haiku): with a Haiku judge and an earlier,
  ambiguous critical-error line, a reasonable WITH answer got three FAIL votes; after fixing the line, with a Sonnet
  judge, the WITH answer got three PASS votes and the W/OUT answer three FAIL votes (cost USD 0.06). That check only
  proves the files load and grade; it is not a result.
- `skill-fired.md` is excluded from the score only in a two-arm run. With `--ablation none` it counts as a second
  grader, so use two arms for any number you publish.
- One case, one run per arm, while editing a checklist:
  `claude plugin eval . --trust-plugin --case even-g2-arabic --runs 1 --no-publish`
- To compare against an agent that can search the web, add `--allow-tools WebSearch WebFetch` to both arms (the
  grant applies to every case). Report this as a separate result, not mixed with the default run.
- `--json evals/results/<date>.json` keeps the machine-readable result next to the HTML report.

## Running the trigger check

`triggers.json` has 40 one-line prompts: 20 that should load one of our skills (with the expected skill and other
acceptable skills from this repository) and 20 realistic near-misses that should load none (Meta Quest and Unity,
Apple Vision Pro, Apple Watch, regular Android UI, speech-to-text for a website, ARCore, smart home, VR headsets,
Bluetooth headphones, video subtitling, game HUDs and more). Wording mixes casual and precise; some prompts name
only a model ("Z100", "G2 plugin"), some only say "HUD" or "AI glasses".

```bash
node evals/run-triggers.mjs --model sonnet --runs 1 --json evals/results/triggers-<date>.json
```

The script starts one short `claude -p` session per prompt (at most 2 turns, only `Skill` pre-approved) in an empty
temporary directory with `--plugin-dir` pointing at this repository, and records the first skill invoked. It
reports the hit rate for prompts that should trigger, the clean rate for prompts that should not, and the overall
rate. Unlike `claude plugin eval`, `claude -p` still loads your personal skills and settings, so a skill installed
on your machine (for example a vendor's own skill) can take a prompt first and show up as `other-skill`. For clean
numbers run it on a CI runner or a user profile with no other skills installed. Use `--only t01,n03` to rerun single
prompts.

## Keeping the suite honest

- Never edit a checklist to match the skill. If the skill and the checklist disagree, check the source; fix the
  skill if the source agrees with the checklist, fix the checklist (with a new date) if the vendor changed.
- Re-check every dated fact before each scored run; vendor platforms change monthly.
- Add a case for each new brand file or skill, with at least one critical error that a wrong answer would make.

## Results

See [RESULTS.md](RESULTS.md) for the latest run, the method and the raw answers.
