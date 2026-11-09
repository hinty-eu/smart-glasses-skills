# Evaluation results

Run on 2026-11-09. Raw data: [`runs/2026-11-09/`](runs/2026-11-09/).

## Summary

| | With the skills | Without |
|---|---|---|
| Average checklist score (22 answers each) | **87%** | 39% |
| Answers that pass (70% or more, no critical error) | **20 of 22** | 1 of 22 |
| Confirmed critical errors | **0** | 4 |

Skill triggering, 40 prompts: no false triggers on 20 near misses (Meta Quest, Apple Vision Pro, Wear OS, ARCore,
OBS captions and similar); 17 of 20 hits on the prompts that should use a skill. The 3 misses were Even G2 questions
answered by Even's own official skill, which was installed on the test machine; this repository tells agents to
prefer that skill for Even SDK detail.

## Method

- **Tasks:** 11 developer requests in [`evals/`](.), one folder each: live captions on Even G2, text from a server on
  Rokid, captions on Vuzix Z100 from an iPhone, Meta Ray-Ban Display with a publishing deadline, Meta DAT registration
  errors, choosing glasses for a teleprompter, voice hints on Ray-Ban Meta, Arabic on G2, testing a G2 app in CI,
  one double-tap action on four brands, subtitles on XREAL glasses.
- **Checklists:** 11 to 14 items per task, each factual item with an official source and a date, plus a list of
  critical errors (for example recommending an SDK that is not public, or a store that cannot distribute apps). The
  checklists were written from vendor documentation, not from the skill text.
- **Agents:** `claude plugin eval` with `--ablation with-without`, Claude Code 2.1.318, model alias `sonnet`, in a
  fresh isolated session per run with read-only tools and no web access in either arm. Each task ran twice per arm
  (two separate runs on the same day; the skill text received fixes between them, see below).
- **Grading:** all 44 answers were shuffled and graded blind by Claude Opus 5.5, item by item (1, 0.5 or 0). The
  grader never saw which arm produced an answer, verified every flagged critical error against the official source,
  and kept a critical error only with a verbatim quote. Local file paths in two answers were replaced with `<repo>/`;
  answers are otherwise verbatim.

## Per task (run 1 / run 2)

| Task | With | Without |
|---|---|---|
| choose-glasses-teleprompter | 75 / 92 | 38 / 33 (both recommend MentraOS, which cannot distribute apps) |
| double-tap-every-brand | 100 / 96 | 23 / 18 |
| even-g2-arabic | 75 / 100 | 21 / 21 |
| even-g2-ci-without-glasses | 79 / 75 | 17 / 17 |
| even-g2-live-captions | 65 / 92 | 31 / 69 |
| meta-dat-no-eligible-device | 73 / 68 | 41 / 36 |
| meta-display-publish-next-month | 88 / 92 | 21 / 21 |
| ray-ban-meta-voice-hints | 100 / 100 | 79 / 63 |
| rokid-text-from-server | 92 / 92 | 35 / 31 (both build on Rokid's business-only CXR-M SDK) |
| vuzix-z100-ios-captions | 92 / 85 | 58 / 62 |
| xreal-subtitles-android | 89 / 92 | 54 / 62 |

Averages by run: with the skills 84% (run 1) and 89% (run 2); without 38% and 39%.

## What changed between the runs

After run 1 we fixed the gaps it exposed: a worked "ship this month" example in `choose-target.md`, Even G2 font and
image rules for scripts the glasses cannot render, microphone capture inside an Even Hub plugin, and the Rokid iOS
account requirement. We also told judges to quote any critical error they report.

## About the built-in judge

`claude plugin eval` also scores each run pass or fail with a three-vote judge (Sonnet, pass at 70%). It gave the
skills 7 of 11 passes in run 1 and 2 of 11 in run 2, and 0 of 11 without the skills both times. The blind item-by-item
grading above rated run 2 higher than run 1, so we treat the pass/fail judge as too noisy near its threshold and report
the item scores. Both judge outputs are in [`runs/2026-11-09/`](runs/2026-11-09/) (`plugin-eval-run1.json`,
`plugin-eval-run2.json`).

## Limits

- One model family and two runs per arm. Expect a few points of variance per task.
- No web access in either arm. An agent with web search would close part of the gap, more slowly and with older
  sources; we did not measure that.
- The checklists check knowledge and decisions, not whether the code runs on glasses. Nothing here was tested on
  hardware.

## Reproduce

```bash
claude plugin eval . --trust-plugin --ablation with-without --runs 2 --model sonnet --judge-model sonnet --no-publish
node evals/run-triggers.mjs --model sonnet --runs 1
```
