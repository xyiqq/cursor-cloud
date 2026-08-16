# dsh-plugin-liang-calibrator

**滑动变祖器** — the [liang-intensity-calibrator](https://github.com/Lichtspektrum/liang-intensity-calibrator) as the DeepSeek Harness **thinking-effort calibrator** (with a separate model list).

[![Preview](https://pbs.twimg.com/amplify_video_thumb/2087967285621542912/img/Vk2-2wdcV3s2ITIO.jpg)](https://x.com/BruzWJ/status/2087968145114120691)

Clicking the composer's model seat opens the 31-level calibrator. **Model** and
**effort** are chosen separately:

1. Use the **模型 / Model** row under the slider to pick a model.
2. After that, the slider only remaps across that model's reasoning-effort
   levels (for example Off / High / Max). Sliding never switches models.

The six stage names (小难梁 → 梁祖) still follow the 0–30 portrait track for
visual flair; they are not a 1:1 catalog of every model×effort combo.

| Example (3 efforts on one model) | Position band (approx.) |
| --- | --- |
| Off | 00–10 |
| High | 10–20 |
| Max | 20–30 |

With any other effort list the slider splits 0–30 proportionally across that
model's efforts only.

## Install

```sh
dsh plugin --profile web add dsh-plugin-liang-calibrator
```

then register the entry in your profile's `cordis.patch.yml`
(`$DSH_HOME/profiles/web/cordis.patch.yml`):

```yaml
- insert:
    - id: liang-calibrator
      name: dsh-plugin-liang-calibrator
```

and restart `dsh web`.

## How it works

- **Host half** (`lib/index.js`): serves the 31 portrait keyframes under
  `/liang-assets/frames/` through the profile's `webServer` service — no CDN,
  no patched static server.
- **Browser half** (`lib/client.js`): a standard `dsh.client` bundle that
  registers the `conversation.input.model` slot at **priority −1**. Slot
  rendering is priority-based ("lowest renders"), so the calibrator shadows the
  stock selector without touching it — uninstalling the plugin restores the
  original UI.
- The portrait is drawn from per-level keyframes rather than a scrubbed video:
  the stock static server has no HTTP Range support, so media-element seeking
  silently fails; image keyframes work everywhere.
- Requires `@deepseek-ai/dsh-client-ui-model-selection` (ships with the default
  web profile) for the shared model directory service.

## Desktop fork note

DeepSeek Harness Desktop ships a patched copy under
`plugins/dsh-plugin-liang-calibrator/` where the slider is **effort-only for the
current model** (upstream originally chained every model×effort into one axis).

## Uninstall

```sh
dsh plugin --profile web remove dsh-plugin-liang-calibrator
```

(and drop the entry from `cordis.patch.yml`).

## Development

Regenerate the browser bundle from an installed DSH checkout:

```sh
python3 scripts/assemble-client.py /path/to/node_modules/@deepseek-ai [region.js]
```

## Portraits

`lib/assets/frames/frame-00.webp … frame-30.webp` derive from the
[liang-intensity-calibrator](https://github.com/Lichtspektrum/liang-intensity-calibrator)
project's `public/frames`. Reuse or redistribution requires confirming you hold
the relevant portrait and asset rights (see that project's README).
