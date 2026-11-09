# Contributing

Thanks for helping. This project lives or dies by accurate, current facts, so the rules below are mostly about that.

## Ground rules

- **Write in your own words and link to the source.** Do not paste vendor documentation or SDK code. Several vendor
  licenses forbid redistribution, and a link ages better than a copy.
- **Every fact needs a source and a date.** Facts about platforms live in `data/platforms.json` with `source`,
  `checked` (YYYY-MM-DD) and `confidence` (`official`, `community`, `press`, `unverified`). Tables are generated from
  it: run `node scripts/gen-tables.mjs` after editing.
- **Say how you verified it.** Examples and brand files carry a `verified` level, plus a date:
  `hardware` (ran on the glasses), `simulator` (ran in the vendor's simulator or emulator), `browser` (a web target ran
  in a desktop browser), `compiles` (builds, never ran) or `docs-only` (written from documentation). Never claim
  `hardware` without testing on the device.
- **Point to the vendor's skill when it is good.** Even Realities, Meta and Google ship official skills. We map and
  connect, we do not duplicate them.
- **Plain hyphens only.** No em or en dashes in Markdown.

## Ways to help

- **Hardware verification:** you own a pair of glasses and ran one of the examples? Open a
  [Hardware verification report](https://github.com/hinty-eu/smart-glasses-skills/issues/new?template=hardware-verification.yml). It is the most valuable
  contribution we get.
- **Wrong or outdated fact:** open an issue with the source, or a pull request that edits `data/platforms.json`.
- **New brand:** open a [New brand](https://github.com/hinty-eu/smart-glasses-skills/issues/new?template=new-brand.yml) issue first, so we can agree on scope.

## Before you open a pull request

```bash
node scripts/check-repo.mjs      # frontmatter, file limits, style
node scripts/gen-tables.mjs --check
```

CI runs the same checks, plus a secret scan and an install test.

## Skill files

- One folder per skill under `skills/`, named with the `smart-glasses` prefix. `name` in `SKILL.md` must match the folder.
- The `description` says what the skill does, when to use it ("Use when ..."), and when not to.
- Keep `SKILL.md` under 500 lines. Put detail in `references/` inside the same skill folder, because installing a
  single skill copies only its own folder.
