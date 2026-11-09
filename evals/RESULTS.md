# Evaluation results

Run on 2026-11-09. Raw data: [`runs/2026-11-09/`](runs/2026-11-09/).

## Headline (run 2, the skill text released as v1.0.0)

| | With the skills | Without |
|---|---|---|
| Average checklist score (11 answers each) | **89%** | 39% |
| Answers that pass (70% or more, no critical error) | **10 of 11** | 0 of 11 |
| Confirmed critical errors | **0** | 2 |

Run 1 used the skill text before the fixes described below: 84% vs 38%, 10 of 11 vs 1 of 11 passing, 0 vs 2 critical
errors. The without-skill arm is the same in both runs, so it shows the run-to-run noise (38% and 39%).

## Method

- **Tasks:** 11 developer requests in [`evals/`](.), one folder each: live captions on Even G2, text from a server on
  Rokid, captions on Vuzix Z100 from an iPhone, Meta Ray-Ban Display with a publishing deadline, Meta DAT registration
  errors, choosing glasses for a teleprompter, voice hints on Ray-Ban Meta, Arabic on G2, testing a G2 app in CI,
  one double-tap action on four brands, subtitles on XREAL glasses.
- **Checklists:** 11 to 14 items per task, each factual item with an official source and a date, plus a list of
  critical errors (for example recommending an SDK that is not public, or a store that cannot distribute apps). They
  were written from vendor documentation, not copied from the skill text, but by the same maintainers: the tasks cover
  what the skills cover, so read the numbers as "the skills do what they claim", not as a general benchmark.
- **Agents:** `claude plugin eval` with `--ablation with-without`, Claude Code 2.1.318, model alias `sonnet` (Claude
  Sonnet 5.5 on 2026-11-09), one fresh isolated session per run, read-only tools, no web access in either arm.
- **Grading:** answers from both runs (44 in total) were shuffled and graded blind by Claude Opus 5.5, item by item
  (1, 0.5 or 0), with web access to check sources. The grader never saw which arm produced an answer, and kept a
  critical error only with a verbatim quote that it had verified against an official page. The exact prompt is in
  [`grading-prompt.md`](runs/2026-11-09/grading-prompt.md); every score has a one-line reason in
  [`grades/`](runs/2026-11-09/grades/). Local file paths in one answer were replaced with `<repo>/`; answers are
  otherwise verbatim (stored as `.txt`).

## Per task

Blind item scores in percent, and the built-in `claude plugin eval` judge votes (P = pass, F = fail, three votes).

| Task | Run 1 with / without | Run 2 with / without | Judge votes run 1 (with, without) | Judge votes run 2 (with, without) |
|---|---|---|---|---|
| choose-glasses-teleprompter | 75 / 38 | 92 / 33 | FFF, FFF | FFP, FFF |
| double-tap-every-brand | 100 / 23 | 96 / 18 | PPP, FFF | FFF, FFF |
| even-g2-arabic | 75 / 21 | 100 / 21 | FFF, FFF | PPP, FFF |
| even-g2-ci-without-glasses | 79 / 17 | 75 / 17 | PPP, FFF | FPF, FFF |
| even-g2-live-captions | 65 / 31 | 92 / 69 | FFF, FFF | FFF, FFF |
| meta-dat-no-eligible-device | 73 / 41 | 68 / 36 | PPP, FFF | PFF, FFF |
| meta-display-publish-next-month | 88 / 21 | 92 / 21 | FPP, FFF | FFF, FFF |
| ray-ban-meta-voice-hints | 100 / 79 | 100 / 63 | PPP, FFF | PPP, FFF |
| rokid-text-from-server | 92 / 35 | 92 / 31 | FPF, FFF | FFF, FFF |
| vuzix-z100-ios-captions | 92 / 58 | 85 / 62 | FPP, FFF | FFP, FFF |
| xreal-subtitles-android | 89 / 54 | 92 / 62 | PPP, FFF | FFF, FFF |

Confirmed critical errors without the skills: both runs of `choose-glasses-teleprompter` recommend MentraOS as a
distribution path (Mentra: miniapps cannot be distributed yet), and both runs of `rokid-text-from-server` build on
CXR-M, Rokid's business-only SDK.

## The built-in judge disagrees, and we cannot see why

`claude plugin eval` scores each run pass or fail with three votes (Sonnet, pass at 70%). It never passed a
without-skill answer, but it was also harsh and inconsistent on with-skill answers: 7 of 11 passes in run 1 and 2 of 11
in run 2. The clearest disagreement is `double-tap-every-brand` in run 2: three FAIL votes, while the blind grade is
96% with every item justified in [`grades/double-tap-every-brand.json`](runs/2026-11-09/grades/double-tap-every-brand.json).
The built-in judge stores only its votes, not its reasons, so we cannot explain individual votes. We report the blind
item scores because each point can be checked; the judge's raw output is in `plugin-eval-run1.json` and
`plugin-eval-run2.json`.

## What changed between the runs

After run 1 we fixed the gaps it exposed: a worked "ship this month" example in `choose-target.md`, Even G2 font and
image rules for scripts the glasses cannot render, microphone capture inside an Even Hub plugin, and the Rokid iOS
account requirement. We also told judges to quote any critical error they report. After run 2 we made factual
corrections only (Vuzix Z100 discontinued, version numbers); no rerun yet.

## Skill triggering

40 prompts: 20 that should use one of the skills and 20 near misses (Meta Quest, Apple Vision Pro, Wear OS, ARCore,
OBS captions and similar). Claude Code with the `sonnet` model, one run per prompt, on a machine that also had Even
Realities' and Meta's official skills installed.

| Run | Should trigger: our skill | Taken by Even's official skill | No skill | Near misses that triggered |
|---|---|---|---|---|
| 1 | 13 of 20 | 3 | 4 | 0 of 20 |
| 2 (after sharpening the descriptions) | 17 of 20 | 3 | 0 | 0 of 20 |

The three Even questions going to Even's own skill is the behaviour we want. A run on a clean profile with no other
skills installed is still to do.

## Limits

- One model, two runs per arm. Expect several points of variance per task.
- No web access in either arm. An agent with web search would close part of the gap, more slowly and with older
  sources; we did not measure that.
- The checklists test knowledge and decisions, not whether code runs on glasses. Nothing here was tested on hardware.

## Reproduce

```bash
claude plugin eval . --trust-plugin --ablation with-without --runs 2 --model sonnet --judge-model sonnet --no-publish
node evals/run-triggers.mjs --model sonnet --runs 1
```
