// ============================================
// Terminal Quest CLI - Themes
// ============================================
// Provides colour palettes (via chalk) for dark / light / retro modes.

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
