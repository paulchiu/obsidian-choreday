import { setIcon, setTooltip } from 'obsidian'
import type { Host } from '../components/host'

/** Draws icons and tooltips with Obsidian's own helpers. */
export const obsidianHost: Host = { icon: setIcon, tooltip: setTooltip }
