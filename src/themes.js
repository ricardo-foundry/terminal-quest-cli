/**
 * @module themes
 * @description Colour palettes (chalk-based) for dark / light / retro modes,
 *   plus an ASCII-only fallback palette for low-colour terminals.
 *
 * Custom themes can be added by appending a new entry to `THEMES`. Each
 * palette must implement: primary, secondary, accent, warning, error,
 * success, info, dim, white, bold, gold, purple, orange.
 *
 * Colour selection walks a four-step degradation chain:
 *   truecolor (chalk hex)   -- COLORTERM=truecolor, xterm-256color
 *   256-colour (chalk ANSI) -- modern terminals with TERM containing 256
 *   16-colour (chalk named) -- generic xterm/linux/screen
 *   plaintext (ASCII decorators) -- NO_COLOR, --no-color, TERM=dumb, pipes
 *
 * The exposed `getTheme(name)` returns the palette appropriate for the
 * detected capability level so no caller needs to repeat the check.
 */

'use strict';

const chalk = require('chalk');
const { getCapabilities, ASCII_DECORATORS } = require('./terminal');

/**
 * Build a plaintext theme by mapping each role through an ASCII decorator.
 *
 * @returns {Record<string, (s:string)=>string>}
 */
function buildPlainTheme() {
  return {
    primary: ASCII_DECORATORS.primary,
    secondary: ASCII_DECORATORS.secondary,
    accent: ASCII_DECORATORS.accent,
    warning: ASCII_DECORATORS.warning,
    error: ASCII_DECORATORS.error,
    success: ASCII_DECORATORS.success,
    info: ASCII_DECORATORS.info,
    dim: ASCII_DECORATORS.dim,
    white: ASCII_DECORATORS.white,
    bold: ASCII_DECORATORS.bold,
    gold: ASCII_DECORATORS.gold,
    purple: ASCII_DECORATORS.purple,
    orange: ASCII_DECORATORS.orange
  };
}

/**
 * Build a 16-colour (named-ANSI only) theme for modest terminals.
 * Avoids hex calls so chalk cannot attempt truecolor escape codes.
 *
 * @param {'dark'|'light'|'retro'} name
 * @returns {object}
 */
function build16Theme(name) {
  if (name === 'light') {
    return {
      primary: chalk.green,
      secondary: chalk.cyan,
      accent: chalk.magenta,
      warning: chalk.yellow,
      error: chalk.red,
      success: chalk.greenBright,
      info: chalk.blueBright,
      dim: chalk.gray,
      white: chalk.black,
      bold: chalk.bold,
      gold: chalk.yellow,
      purple: chalk.magenta,
      orange: chalk.yellow
    };
  }
  if (name === 'retro') {
    return {
      primary: chalk.yellow,
      secondary: chalk.yellow,
      accent: chalk.yellowBright,
      warning: chalk.yellow,
      error: chalk.red,
      success: chalk.yellow,
      info: chalk.yellowBright,
      dim: chalk.gray,
      white: chalk.yellowBright,
      bold: chalk.bold,
      gold: chalk.yellow,
      purple: chalk.yellow,
      orange: chalk.yellow
    };
  }
  return {
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
    orange: chalk.yellow
  };
}

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
    // v2.7 (iter-14): give success / gold a distinct shade from primary so
    // [OK] lines don't disappear into the run-of-the-mill amber. Previously
    // success and primary were both #FFB000 which made level-up popups and
    // achievement banners look identical to ordinary text in retro mode.
    primary: chalk.hex('#FFB000'),
    secondary: chalk.hex('#FFA000'),
    accent: chalk.hex('#FFC040'),
    warning: chalk.hex('#FF8C00'),
    error: chalk.hex('#FF4000'),
    success: chalk.hex('#FFE060'),
    info: chalk.hex('#FFD080'),
    dim: chalk.hex('#8B6000'),
    white: chalk.hex('#FFDDAA'),
    bold: chalk.bold,
    gold: chalk.hex('#FFE060'),
    purple: chalk.hex('#FFC040'),
    orange: chalk.hex('#FF8C00')
  }
};

/**
 * @returns {string[]} list of theme names the caller may set.
 */
function availableThemes() {
  return Object.keys(THEMES);
}

/**
 * Fetch the colour palette that matches `name`, degraded to the
 * current terminal's capability level.
 *
 * @param {string} name theme name ('dark' | 'light' | 'retro' | ...)
 * @returns {Record<string,(s:string)=>string>} palette
 */
function getTheme(name) {
  const caps = getCapabilities();
  const themeName = THEMES[name] ? name : 'dark';
  if (caps.colorLevel === 0) return buildPlainTheme();
  if (caps.colorLevel === 1) return build16Theme(themeName);
  // level 2 (256-colour) and 3 (truecolor) both accept hex —
  // chalk itself down-samples 256-colour terminals.
  return THEMES[themeName];
}

module.exports = { THEMES, availableThemes, getTheme, buildPlainTheme, build16Theme };
