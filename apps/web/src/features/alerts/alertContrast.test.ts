import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const tokensCss = readFileSync(resolve(process.cwd(), 'src/ui/tokens.css'), 'utf8');
const [lightBlock = '', darkBlock = ''] = tokensCss.split('@media (prefers-color-scheme: dark)');

function tokens(block: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6});/g)) result[match[1]!] = match[2]!;
  return result;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const light = tokens(lightBlock);
const dark = { ...light, ...tokens(darkBlock) };

/** Pares de texto de una fila revisada (`.row[data-acknowledged]`: fondo --bg, sin opacity). */
const PAIRS: ReadonlyArray<[string, string]> = [
  ['text', 'bg'],
  ['text-muted', 'bg'],
  ['status-offline-fg', 'status-offline-bg'],
];

describe.each([
  ['claro', light],
  ['oscuro', dark],
])('contraste de filas revisadas (tema %s)', (_theme, palette) => {
  it.each(PAIRS)('%s sobre %s cumple AA (>= 4.5:1)', (fg, bg) => {
    expect(palette[fg], fg).toBeDefined();
    expect(palette[bg], bg).toBeDefined();
    expect(contrast(palette[fg]!, palette[bg]!)).toBeGreaterThanOrEqual(4.5);
  });
});
