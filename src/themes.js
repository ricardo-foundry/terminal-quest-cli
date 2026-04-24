/**
 * @module themes
 * @description Colour palettes (chalk-based) for dark / light / retro modes.
 *
 * Custom themes can be added by appending a new entry to `THEMES`. Each
 * palette must implement: primary, secondary, accent, warning, error,
 * success, info, dim, white, bold, gold, purple, orange.
 *
 * `chalk` autodetects terminal colour support and degrades gracefully:
 *   - 256-colour / truecolor terminals get the exact hex tones (retro CRT)
 *   - 16-colour terminals collapse to the nearest named ANSI colour
 *   - non-TTY (CI, pipes) strips colour entirely.
 */

const chalk = require('chalk');

const THEMES = {
  dark: {
    primary: chalk.greenBright,
    secondary: chalk.cyanBright,
    accent: chalk.magentaBright,
    warning: chalk.yellowBright,
    error: chalk.redBright,
    success: chalk.green,
    info: chalk.blue,
    dim: chalk.gray,
    white: chalk.white,
    bold: chalk.bold,
    gold: chalk.yellow,
    purple: chalk.magenta,
    orange: chalk.hex('#FFA500')
  },
  light: {
    primary: chalk.green,
    secondary: chalk.cyan,
    accent: chalk.magenta,
    warning: chalk.hex('#B8860B'),
    error: chalk.red,
    success: chalk.greenBright,
    info: chalk.blueBright,
    dim: chalk.gray,
    white: chalk.black,
    bold: chalk.bold,
    gold: chalk.hex('#B8860B'),
    purple: chalk.magenta,
    orange: chalk.hex('#D2691E')
  },
  retro: {
    // amber monochrome - classic CRT
    primary: chalk.hex('#FFB000'),
    secondary: chalk.hex('#FFA000'),
    accent: chalk.hex('#FFC040'),
    warning: chalk.hex('#FF8C00'),
    error: chalk.hex('#FF4000'),
    success: chalk.hex('#FFB000'),
    info: chalk.hex('#FFD080'),
    dim: chalk.hex('#8B6000'),
    white: chalk.hex('#FFDDAA'),
    bold: chalk.bold,
    gold: chalk.hex('#FFB000'),
    purple: chalk.hex('#FFC040'),
    orange: chalk.hex('#FF8C00')
  }
};

function availableThemes() {
  return Object.keys(THEMES);
}

function getTheme(name) {
  return THEMES[name] || THEMES.dark;
}

module.exports = { THEMES, availableThemes, getTheme };
