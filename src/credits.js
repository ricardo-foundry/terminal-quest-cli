/**
 * @module credits
 * @description Pure text content for the hidden `--credits` flag.
 *
 * v2.10 (iter-20). Kept in its own module so the bin entry point can pull
 * it in without dragging in the whole game runtime, and so unit tests can
 * verify the contributor roll without exec'ing the binary.
 *
 * The lines below are intentionally plain ASCII — they need to render in
 * a 40-column TTY, in `--no-color` mode, and on Windows cmd.exe without
 * any glyph fallbacks. No emoji, no extended box-drawing characters.
 *
 * If you contribute and want your name on the roll, add it to the
 * "Author & maintainer" or "Pair-programmer" section by submitting a PR.
 */

'use strict';

function creditsLines() {
  return [
    '',
    '   ____________________________',
    '  /                            \\',
    ' |    Terminal Quest CLI       |',
    ' |    a small story for the    |',
    ' |    cursor and whoever       |',
    ' |    happens to be reading.   |',
    '  \\____________________________/',
    '         |    |',
    '         |    |',
    '       __|____|__',
    '      [__________]',
    '',
    '  ============================',
    '  =      C R E D I T S      =',
    '  ============================',
    '',
    '  Author & maintainer',
    '    Ricardo (ricardo-foundry)',
    '',
    '  Pair-programmer & co-author',
    '    Claude Code  --  a benevolent assistant',
    '                     who haunts the terminal',
    '',
    '  Translations',
    '    en, zh, zh-tw, ja, es  (community)',
    '',
    '  Inspirations',
    '    Linux, Unix, every old MUD,',
    '    the people who taught us to',
    '    type "ls" for the first time.',
    '',
    '  Tools that mattered',
    '    node.js, chalk, figlet, keypress',
    '',
    '  And you, reading this. Thanks',
    '  for spending a few minutes inside',
    '  a tiny imagined OS.',
    '',
    '  ============================',
    '',
    '  "Some bytes find their author.',
    '   Most just find a good home."',
    '',
    ''
  ];
}

/**
 * Roll credits to the given write fn. In a TTY we slow-scroll at ~60ms
 * per line; otherwise we dump in one shot so CI / pipes never hang.
 *
 * @param {object} [opts]
 * @param {(s:string)=>void} [opts.write]  defaults to console.log
 * @param {boolean} [opts.fast]            force one-shot (no delay)
 * @returns {Promise<number>}              number of lines printed
 */
async function rollCredits(opts) {
  const write = (opts && opts.write) || ((s) => console.log(s));
  const fast = !!(opts && opts.fast);
  const lines = creditsLines();
  if (fast) {
    for (const line of lines) write(line);
    return lines.length;
  }
  for (const line of lines) {
    write(line);
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  return lines.length;
}

module.exports = { creditsLines, rollCredits };
