# Smart Glasses Skills

> **Preview.** This repository is being built in the open. v1.0 is planned for 25 November 2026.

Agent skills that teach coding agents (Claude Code, Codex, Cursor, Copilot, Gemini CLI) how to build apps for smart
glasses from every major brand: pick a target, get text onto the display, handle input and audio, test without the
hardware, and check what you can actually publish today.

```bash
npx skills add hinty-eu/smart-glasses-skills
```

<details>
<summary>Claude Code plugin</summary>

```
/plugin install smart-glasses-skills --marketplace hinty-eu/smart-glasses-skills
```

</details>

## Platforms

<!-- platforms:start columns=display,text,publish -->
_No platforms yet._
<!-- platforms:end -->

## What these skills do, send and download

The skills are plain Markdown files that your agent reads. They do not run code on install, send data anywhere or
download anything. The examples in `examples/` are small apps you build yourself; each one says what it connects to.

## Who maintains this

Built and maintained by the team behind [Hinty Voice Assistant](https://www.hinty.eu/assistant/smart-glasses?utm_source=github&utm_medium=readme&utm_campaign=smart-glasses-skills).
Vendor names are used only to identify products; see [TRADEMARKS.md](TRADEMARKS.md).

## License

Code and skills: [Apache-2.0](LICENSE). Data in `data/`: [CC BY 4.0](LICENSE-DATA).
