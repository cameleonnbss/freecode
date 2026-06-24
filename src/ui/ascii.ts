/**
 * FreeCode — ASCII art banner.
 *
 * The official "FreeCode" wordmark — a 3D-shadow block-letter design
 * (shadow column on the left + raised letters on the right).
 */

// The canonical FreeCode wordmark. ~95 cols wide — designed for modern
// terminals. Falls back to the compact variant on narrow displays.
export const FREECODE_ASCII = String.raw` ▄▄▄▄▄▄▄▄                                                                    ▄▄           
 ██▀▀▀▀▀▀                                                                    ██           
 ██         ██▄████   ▄████▄    ▄████▄              ▄█████▄   ▄████▄    ▄███▄██   ▄████▄  
 ███████    ██▀      ██▄▄▄▄██  ██▄▄▄▄██            ██▀    ▀  ██▀  ▀██  ██▀  ▀██  ██▄▄▄▄██ 
 ██         ██       ██▀▀▀▀▀▀  ██▀▀▀▀▀▀            ██        ██    ██  ██    ██  ██▀▀▀▀▀▀ 
 ██         ██       ▀██▄▄▄▄█  ▀██▄▄▄▄█            ▀██▄▄▄▄█  ▀██▄▄██▀  ▀██▄▄███  ▀██▄▄▄▄█ 
 ▀▀         ▀▀         ▀▀▀▀▀     ▀▀▀▀▀               ▀▀▀▀▀     ▀▀▀▀      ▀▀▀ ▀▀    ▀▀▀▀▀  `;

// Compact fallback for 80-col terminals.
export const FREECODE_ASCII_COMPACT = String.raw`  ███████ ███████ ██      ███████  ██████   ██████ ██   ██ ███████ ██████
  ██      ██      ██      ██      ██    ██ ██      ██  ██  ██      ██   ██
  █████   █████   ██      █████   ██    ██ ██      █████   █████   ██████
  ██      ██      ██      ██      ██    ██ ██      ██  ██  ██      ██   ██
  ██      ███████ ███████ ███████  ██████   ██████ ██   ██ ███████ ██   ██`;

// Subtle one-liner — used in non-interactive mode.
export const FREECODE_INLINE = 'FreeCode';

export const TAGLINE = {
  fr: 'Assistant de codage IA gratuit — terminal',
  en: 'Free AI coding assistant — terminal',
};

export const BYLINE = 'by cameleonnbss';

/** Pick the right ASCII variant based on terminal width. */
export function pickAscii(columns?: number): string {
  const cols = columns ?? process.stdout.columns ?? 80;
  return cols >= 100 ? FREECODE_ASCII : FREECODE_ASCII_COMPACT;
}
