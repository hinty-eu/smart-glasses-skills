# Blind grading prompt (2026-11-09)

Used for all 44 answers, split across three grader sessions (Claude Opus 5.5, with web access to verify sources).
The answers were shuffled per task and labelled A to D; the key (`answer-key.json`) was kept out of the graders' reach.

> You are a strict, fair, blind grader. For each case below, four answers (A-D) were written by coding agents for the
> same developer request. Some had extra reference material, some did not; you do not know which, and you must not try
> to find out. Do NOT open the answer key, any run or results files, or anything under `skills/` or `examples/` (to
> stay independent).
>
> Inputs per case: the request `evals/<case>/prompt.md`, the checklist `evals/<case>/graders/checklist.md` (numbered
> items with official sources + "Critical errors"), and the answers.
>
> For each answer: score every checklist item 1 (clearly covered and correct), 0.5 (partly) or 0 (missing or wrong),
> with a reason of max 12 words; compute percent = points / items. Check every critical error: flag one ONLY with a
> verbatim quote from the answer, and verify it against the checklist's source or an official page (web fetch
> allowed); mark each flagged error `confirmed` or `not-an-error` with a one-line reason. Things not on the checklist
> but clearly correct and useful do not add points; clearly wrong extra claims that matter to the developer should be
> listed under `other_errors` with a quote.
