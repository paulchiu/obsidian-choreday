# Install

Choreday is not in Obsidian's community plugin directory yet. Install it with BRAT or manually from a GitHub release.

## Installing with BRAT

BRAT tracks a plugin's GitHub repository and installs each release as it is published.

To install Choreday with the [BRAT community plugin](https://github.com/TfTHacker/obsidian42-brat):

1. Install and enable BRAT from Obsidian's community plugins.
2. Run `BRAT: Add a beta plugin for testing` from the command palette.
3. Enter `https://github.com/paulchiu/obsidian-choreday`, keep Latest version selected, and select Add plugin.
4. Enable Choreday from the community plugins list if BRAT has not already.

To install new releases automatically, turn on "Auto-update plugins at startup" in BRAT's settings. Otherwise, run `BRAT: Check for updates to all beta plugins and UPDATE`.

## Installing manually

To install manually from a release:

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/paulchiu/obsidian-choreday/releases/latest).
2. Put them in `<vault>/.obsidian/plugins/choreday/`, creating the folder if needed.
3. Reload Obsidian, then enable Choreday from the community plugins list.

Manual installs don't update themselves. Repeat these steps for each new release.
