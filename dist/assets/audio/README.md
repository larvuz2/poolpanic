# Recorded audio

Everything in Pool Panic is synthesised, except what is listed in `dist/audio-files.mjs`. Drop a recording here and
add its path to that list to use it instead of the placeholder.

- **Karen's voice** (`AUDIO_FILES.karen`): short complaining clips, played at random every one to two seconds
  while she is shouting. Without files the game plays a synthesised babble.

## The menu (20 October 2026)

Made with ElevenLabs on fal (Music v2.5 and Sound Effects v2) and played by `PoolAudio.startMenu` and `ui` in `dist/audio.mjs`:

- `menu-theme.mp3` (the menu's theme, 112 s) and `menu-return.mp3` (after a shift): calm-before-the-storm pieces, each made to
  loop seamlessly by crossfading its end into its start (equal power) before encoding at 160 kbps.
- `menu-ambience.mp3`: the empty hall (water lapping, a far drip, the building's hum), a 20 s loop at about −26 dB.
- `ui-hover.mp3` and `ui-click.mp3`: a soft tick and a click with a short tail.

Written proof that ElevenLabs' terms allow commercial use of these is one of the creator's to-dos before release (CLAUDE.md).
