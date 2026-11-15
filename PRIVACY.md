# Privacy

Smart Glasses Skills collects no data. The skills are Markdown files that your coding agent reads on your own
machine. They contain no telemetry and make no network calls, and Hinty, the publisher, receives nothing when you
install or use them.

The tools you install the skills with are separate products with their own privacy terms, for example the `skills`
CLI (`npx skills add`) and the plugin managers in Claude Code, Codex, Cursor and Gemini CLI.

The examples run only when you build and start them yourself. The live-captions server in `--demo` mode talks only to
the devices that connect to it. With `--stt deepgram` it streams microphone audio to Deepgram with your own API key,
so Deepgram's terms apply to that audio. When the skills point your agent to a vendor SDK or a speech-to-text
provider, check that service's policy before you send it your users' data.

Questions: support@hinty.eu
