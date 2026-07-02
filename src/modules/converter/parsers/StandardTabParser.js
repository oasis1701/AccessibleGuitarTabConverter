/**
 * @fileoverview Parser for standard and labeled tablature formats.
 *
 * Parsing runs as a staged pipeline:
 *   classify lines → group sections → assign string names →
 *   align bodies → tokenize each string → bind techniques →
 *   build column events with measure numbers.
 *
 * Columns are indexed into the musical body (after the string label is
 * stripped), so labels of different widths cannot desynchronize chords.
 * Digit runs are consumed once, so multi-digit frets like 12 can never
 * be re-read as a second note.
 *
 * @module converter/parsers/StandardTabParser
 */

import { TUNING_TEMPLATES, MAX_FRET } from '../../../utils/constants.js';
import {
  splitStringLabel,
  isMusicContent,
  isTechniqueLine
} from '../../../utils/validators.js';
import { getOrdinalSuffix } from '../../../utils/helpers.js';

/** Technique symbols recognized inside a string body (x is a mute, not a technique). */
const TECH_SYMBOLS = new Set(['h', 'p', 'b', 'r', 's', '/', '\\', '~', 't', '^', 'v', '.', '>']);

/** Display names for technique detail types. */
const TECH_NAMES = {
  'hammer-on': 'hammer-on',
  'pull-off': 'pull-off',
  bend: 'bend',
  release: 'release',
  'slide-up': 'slide up',
  'slide-down': 'slide down',
  slide: 'slide',
  vibrato: 'vibrato',
  tap: 'tap',
  staccato: 'staccato',
  accent: 'accent',
  'ghost note': 'ghost note',
  harmonic: 'harmonic'
};

/** Describe a fret as spoken text ("open string" / "5th fret"). */
function fretWord(fret) {
  return fret === 0 ? 'open string' : `${fret}${getOrdinalSuffix(fret)} fret`;
}

/**
 * Class to parse standard and labeled tablature formats
 */
export class StandardTabParser {
  /**
   * Parse tablature lines into structured data
   * @param {string[]} lines - All lines from the tab, blanks included
   * @returns {{sequences: Array<Object>, annotations: Array<Object>}} Parsed tab
   * @throws {Error} When no tab lines can be found
   */
  parse(lines) {
    if (!Array.isArray(lines)) {
      throw new Error('Nothing to convert yet. Paste a guitar tab first.');
    }

    const classified = this.classifyLines(lines);
    const groups = this.groupSections(classified);

    if (groups.length === 0) {
      throw new Error(
        'No guitar tab lines found. A tab needs at least two string lines ' +
          'made of dashes and fret numbers, like e|--3--5--|.'
      );
    }

    const sequences = groups
      .map((group, index) => this.parseGroup(group, index + 1))
      .filter(sequence => sequence.notes.length > 0);

    return {
      sequences,
      annotations: this.collectAnnotations(classified)
    };
  }

  /**
   * Classify each raw line as string music, annotation, legend or blank.
   * @param {string[]} lines - Raw input lines
   * @returns {Array<Object>} Classified lines
   * @private
   */
  classifyLines(lines) {
    return lines.map((raw, lineNumber) => {
      const line = raw.replace(/\r$/, '').replace(/\s+$/, '');
      const text = line.trim();

      if (!text) {
        return { type: 'blank', lineNumber };
      }

      if (isTechniqueLine(text)) {
        return { type: 'legend', text, lineNumber };
      }

      const labeled = splitStringLabel(line);
      if (labeled && isMusicContent(labeled.body)) {
        return {
          type: 'string',
          label: labeled.label,
          body: labeled.body,
          lineNumber
        };
      }

      if (isMusicContent(text)) {
        return { type: 'string', label: null, body: text, lineNumber };
      }

      return { type: 'annotation', text, lineNumber };
    });
  }

  /**
   * Group consecutive string lines into sections. A blank, annotation or
   * legend line always terminates the current group, so separate tab blocks
   * can never merge into one oversized "instrument".
   * @param {Array<Object>} classified - Classified lines
   * @returns {Array<Object>} Section groups with rows and optional heading
   * @private
   */
  groupSections(classified) {
    const groups = [];
    let rows = [];
    let firstIndex = -1;

    const closeGroup = () => {
      const labeledCount = rows.filter(row => row.label).length;
      if (labeledCount >= 2 || rows.length >= 3) {
        groups.push({
          rows,
          heading: this.findHeading(classified, firstIndex)
        });
      }
      rows = [];
      firstIndex = -1;
    };

    classified.forEach((entry, index) => {
      if (entry.type === 'string') {
        if (rows.length === 0) firstIndex = index;
        rows.push(entry);
      } else if (rows.length > 0) {
        closeGroup();
      }
    });
    if (rows.length > 0) closeGroup();

    return groups;
  }

  /**
   * Find a short annotation just above a group to use as its heading
   * (e.g. "[Intro]" or "Verse 1").
   * @param {Array<Object>} classified - Classified lines
   * @param {number} firstIndex - Index of the group's first string line
   * @returns {string|null} Heading text without brackets
   * @private
   */
  findHeading(classified, firstIndex) {
    for (let k = firstIndex - 1; k >= 0 && k >= firstIndex - 2; k--) {
      const entry = classified[k];
      if (entry.type === 'blank') continue;
      if (
        entry.type === 'annotation' &&
        entry.text.length <= 40 &&
        !this.isChordNameLine(entry.text)
      ) {
        return entry.text.replace(/^\[/, '').replace(/\]$/, '').trim();
      }
      break;
    }
    return null;
  }

  /**
   * Check whether text is a line of chord names ("C  G  Am  F").
   * @param {string} text - Annotation text
   * @returns {boolean} True for chord-name lines
   * @private
   */
  isChordNameLine(text) {
    return /^[A-G][#b]?[\w*]*(\s+[A-G][#b]?[\w*]*)+$/.test(text);
  }

  /**
   * Parse one section group into a note sequence.
   * @param {Object} group - Section group with rows
   * @param {number} sectionNumber - 1-based section number
   * @returns {Object} Sequence with column events and measure info
   * @private
   */
  parseGroup(group, sectionNumber) {
    const strings = this.assignStrings(group.rows);
    this.alignBodies(strings);

    const allNotes = [];
    const barCounts = new Map();

    for (const string of strings) {
      const tokens = this.tokenize(string.content);
      for (const token of tokens) {
        if (token.kind === 'bar') {
          barCounts.set(token.col, (barCounts.get(token.col) || 0) + 1);
        }
      }
      allNotes.push(...this.buildNotes(tokens, string));
    }

    // A column is a measure boundary when at least half the strings have a
    // bar line there (tolerates a missing | on sloppy lines).
    const threshold = Math.ceil(strings.length / 2);
    const barColumns = [...barCounts.entries()]
      .filter(([, count]) => count >= threshold)
      .map(([col]) => col)
      .sort((a, b) => a - b);

    // Group simultaneous notes (same start column) into events.
    const byPosition = new Map();
    for (const note of allNotes) {
      if (!byPosition.has(note.position)) byPosition.set(note.position, []);
      byPosition.get(note.position).push(note);
    }

    const events = [...byPosition.entries()]
      .sort(([a], [b]) => a - b)
      .map(([position, notes]) => ({
        position,
        measure: 1,
        isChord: notes.length > 1,
        notes: notes.sort((a, b) => a.stringIndex - b.stringIndex)
      }));

    let measureCount = 0;
    if (events.length > 0 && barColumns.length > 0) {
      const first = events[0].position;
      const last = events[events.length - 1].position;
      const interior = barColumns.filter(col => col > first && col <= last);
      for (const event of events) {
        event.measure = 1 + interior.filter(col => col <= event.position).length;
      }
      measureCount = interior.length + 1;
    }

    return {
      section: sectionNumber,
      heading: group.heading,
      measureCount,
      stringCount: strings.length,
      notes: events
    };
  }

  /**
   * Assign a display name and index to every row of a group.
   * Position in the block decides the index; the label only names the
   * string, so duplicate letters (drop tunings) and unknown letters
   * (alternate tunings) are all kept.
   * @param {Array<Object>} rows - Group rows, top line first
   * @returns {Array<Object>} Strings with name, index and content
   * @private
   */
  assignStrings(rows) {
    let ordered = rows;
    if (this.isInverted(rows)) {
      ordered = [...rows].reverse();
    }

    const letters = ordered.map(row =>
      row.label ? this.normalizeLetter(row.label) : null
    );
    const counts = {};
    for (const letter of letters) {
      if (letter) counts[letter] = (counts[letter] || 0) + 1;
    }

    const allBare = ordered.every(row => !row.label);
    const template = allBare
      ? TUNING_TEMPLATES[ordered.length] || null
      : null;

    return ordered.map((row, index) => ({
      name: this.stringName(row, index, ordered.length, letters, counts, template),
      index,
      content: row.body,
      lineNumber: row.lineNumber
    }));
  }

  /**
   * Compute the display name for one string row.
   * @private
   */
  stringName(row, index, total, letters, counts, template) {
    if (!row.label) {
      if (template) return template[index];
      return `String ${index + 1}`;
    }

    const letter = letters[index];
    if (counts[letter] > 1) {
      if (letters.lastIndexOf(letter) === index) return `low ${letter}`;
      if (letters.indexOf(letter) === index && letter === 'E') return 'high E';
      return letter;
    }

    if (letter === 'E') {
      if (index === 0) return 'high E';
      if (index === total - 1) return 'low E';
    }
    return letter;
  }

  /**
   * Uppercase a label letter, keeping its accidental ("f#" → "F#").
   * @private
   */
  normalizeLetter(label) {
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  /**
   * Detect tabs written low string first (e.g. E A D G B e) so they can be
   * flipped into the conventional high-first order.
   * @param {Array<Object>} rows - Group rows
   * @returns {boolean} True when the block is inverted
   * @private
   */
  isInverted(rows) {
    if (rows.some(row => !row.label)) return false;

    const labels = rows.map(row => row.label);
    const first = labels[0];
    const last = labels[labels.length - 1];

    // A lone lowercase "e" is the high E string; if it sits on the bottom
    // line the tab is written low-to-high.
    if (last === 'e' && first !== 'e') return true;

    // All-uppercase standard tuning written low-to-high.
    const letters = labels.map(label => this.normalizeLetter(label));
    if (letters.length === 6 && letters.join(' ') === 'E A D G B E' &&
        rows.every(row => row.label === row.label.toUpperCase())) {
      // High-to-low standard is E B G D A E; low-to-high is E A D G B E.
      return true;
    }

    return false;
  }

  /**
   * Align string bodies onto a shared column grid. Labels were already
   * stripped, so the main job is removing a shared leading bar line and
   * padding to equal length.
   * @param {Array<Object>} strings - Strings with content
   * @private
   */
  alignBodies(strings) {
    const allStartWithBar = strings.every(string => {
      const barIndex = string.content.indexOf('|');
      return barIndex >= 0 && barIndex <= 4;
    });

    if (allStartWithBar) {
      for (const string of strings) {
        string.content = string.content.slice(string.content.indexOf('|') + 1);
      }
    }

    const maxLength = strings.reduce(
      (max, string) => Math.max(max, string.content.length),
      0
    );
    for (const string of strings) {
      string.content = string.content.padEnd(maxLength, '-');
    }
  }

  /**
   * Tokenize a string body in a single pass. Every token advances the
   * cursor by its full width, so a fret like 12 is consumed exactly once.
   * @param {string} content - Aligned string body
   * @returns {Array<Object>} Tokens with kind, col and len
   * @private
   */
  tokenize(content) {
    const tokens = [];
    let pos = 0;

    while (pos < content.length) {
      const char = content[pos];

      if (char === '|') {
        tokens.push({ kind: 'bar', col: pos, len: 1 });
        pos += 1;
      } else if (/\d/.test(char)) {
        let end = pos + 1;
        while (end < content.length && /\d/.test(content[end])) end++;
        const fret = parseInt(content.slice(pos, end), 10);
        tokens.push({
          kind: 'fret',
          col: pos,
          len: end - pos,
          fret,
          valid: fret <= MAX_FRET
        });
        pos = end;
      } else if (char === 'x' || char === 'X') {
        tokens.push({ kind: 'mute', col: pos, len: 1 });
        pos += 1;
      } else if (char === 'o' || char === 'O') {
        tokens.push({ kind: 'fret', col: pos, len: 1, fret: 0, valid: true });
        pos += 1;
      } else if (char === '(') {
        const match = content.slice(pos).match(/^\((\d{1,2})\)/);
        if (match) {
          const fret = parseInt(match[1], 10);
          tokens.push({
            kind: 'fret',
            col: pos,
            len: match[0].length,
            fret,
            valid: fret <= MAX_FRET,
            ghost: true
          });
          pos += match[0].length;
        } else {
          pos += 1;
        }
      } else if (char === '<') {
        const match = content.slice(pos).match(/^<(\d{1,2})>/);
        if (match) {
          const fret = parseInt(match[1], 10);
          tokens.push({
            kind: 'fret',
            col: pos,
            len: match[0].length,
            fret,
            valid: fret <= MAX_FRET,
            harmonic: true
          });
          pos += match[0].length;
        } else {
          pos += 1;
        }
      } else if (TECH_SYMBOLS.has(char)) {
        tokens.push({ kind: 'tech', col: pos, len: 1, symbol: char });
        pos += 1;
      } else {
        pos += 1; // dash, space, colon or unknown character
      }
    }

    return tokens;
  }

  /**
   * Turn one string's tokens into notes, binding techniques to the notes
   * they touch. A technique only applies when its symbol is part of an
   * unbroken run of tokens with the note (no dashes in between), so a
   * neighbouring note's digits or a nearby label can never leak in.
   * @param {Array<Object>} tokens - Tokens from tokenize()
   * @param {Object} string - String metadata (name, index)
   * @returns {Array<Object>} Notes with techniques and details
   * @private
   */
  buildNotes(tokens, string) {
    const byStart = new Map();
    const byEnd = new Map();
    for (const token of tokens) {
      byStart.set(token.col, token);
      byEnd.set(token.col + token.len, token);
    }

    const absorbed = new Set();
    const details = new Map();
    const names = new Map();

    const attach = (token, type, context, extra = {}) => {
      if (!details.has(token)) {
        details.set(token, []);
        names.set(token, []);
      }
      details.get(token).push({ type, context, ...extra });
      const name = TECH_NAMES[type] || type;
      if (!names.get(token).includes(name)) {
        names.get(token).push(name);
      }
    };

    // Walk left/right through a contiguous token chain to the nearest fret.
    const fretLeftOf = (token, skipAbsorbed = false) => {
      let current = byEnd.get(token.col);
      while (
        current &&
        (current.kind === 'tech' || (skipAbsorbed && absorbed.has(current)))
      ) {
        current = byEnd.get(current.col);
      }
      return current && current.kind === 'fret' && current.valid ? current : null;
    };
    const fretRightOf = token => {
      let current = byStart.get(token.col + token.len);
      while (current && current.kind === 'tech') {
        current = byStart.get(current.col + current.len);
      }
      return current && current.kind === 'fret' && current.valid ? current : null;
    };

    for (const token of tokens) {
      if (token.kind !== 'tech') continue;
      const left = fretLeftOf(token);
      const right = fretRightOf(token);

      switch (token.symbol) {
        case 'h':
        case 'p': {
          const type = token.symbol === 'h' ? 'hammer-on' : 'pull-off';
          if (right && left) {
            attach(right, type, `${type} from ${fretWord(left.fret)}`, {
              fromFret: left.fret,
              toFret: right.fret
            });
          } else if (right) {
            attach(right, type, type);
          } else if (left) {
            attach(left, type, type);
          }
          break;
        }
        case 'b':
        case '^': {
          if (left && right) {
            absorbed.add(right);
            attach(left, 'bend', `bend up toward ${fretWord(right.fret)}`, {
              toFret: right.fret
            });
          } else if (left || right) {
            attach(left || right, 'bend', 'bend');
          }
          break;
        }
        case 'r': {
          const owner = fretLeftOf(token, true);
          if (right) absorbed.add(right);
          if (owner) {
            attach(
              owner,
              'release',
              right ? `release back to ${fretWord(right.fret)}` : 'release',
              right ? { toFret: right.fret } : {}
            );
          }
          break;
        }
        case '/':
        case '\\':
        case 's': {
          const type =
            token.symbol === '/'
              ? 'slide-up'
              : token.symbol === '\\'
                ? 'slide-down'
                : 'slide';
          const word = TECH_NAMES[type];
          if (left && right) {
            attach(left, type, `${word} to ${fretWord(right.fret)}`, {
              toFret: right.fret
            });
          } else if (right) {
            attach(right, type, `${word} into`);
          } else if (left) {
            attach(left, type, word);
          }
          break;
        }
        case '~':
        case 'v': {
          const target = left || right;
          if (target) attach(target, 'vibrato', 'vibrato');
          break;
        }
        case 't': {
          const target = left || right;
          if (target) attach(target, 'tap', 'tap');
          break;
        }
        case '.': {
          const target = left || right;
          if (target) attach(target, 'staccato', 'staccato');
          break;
        }
        case '>': {
          const target = left || right;
          if (target) attach(target, 'accent', 'accent');
          break;
        }
      }
    }

    const notes = [];
    for (const token of tokens) {
      if (token.kind !== 'fret' && token.kind !== 'mute') continue;
      if (token.kind === 'fret' && !token.valid) {
        console.warn(`Skipping impossible fret number ${token.fret}`);
        continue;
      }
      if (absorbed.has(token)) continue;

      const techniques = [...(names.get(token) || [])];
      const techniqueDetails = [...(details.get(token) || [])];
      if (token.ghost) {
        techniques.push('ghost note');
        techniqueDetails.push({ type: 'ghost note', context: 'ghost note, played softly' });
      }
      if (token.harmonic) {
        techniques.push('harmonic');
        techniqueDetails.push({ type: 'harmonic', context: 'harmonic' });
      }

      notes.push({
        string: string.name,
        stringIndex: string.index,
        fret: token.kind === 'mute' ? 'mute' : token.fret,
        techniques,
        techniqueDetails,
        position: token.col
      });
    }

    return notes;
  }

  /**
   * Collect non-tab lines as annotations for the output summary.
   * @param {Array<Object>} classified - Classified lines
   * @returns {Array<Object>} Annotations with text and category
   * @private
   */
  collectAnnotations(classified) {
    const annotations = [];

    for (const entry of classified) {
      if (entry.type !== 'annotation') continue;
      const text = entry.text;

      let category = 'note';
      if (/^\[.*\]$/.test(text) || /^[IVX]+\s*-/.test(text) ||
          /^(intro|verse|chorus|bridge|solo|outro|pre-chorus|interlude)\b/i.test(text)) {
        category = 'section';
      } else if (text.includes('"')) {
        category = 'lyrics';
      } else if (/\d+:\d+/.test(text)) {
        category = 'timing';
      } else if (/repeat|times|x\d+/i.test(text)) {
        category = 'instruction';
      } else if (this.isChordNameLine(text)) {
        category = 'chords';
      }

      annotations.push({
        text: text.replace(/^\[/, '').replace(/\]$/, '').trim(),
        lineNumber: entry.lineNumber,
        category
      });
    }

    return annotations;
  }
}
