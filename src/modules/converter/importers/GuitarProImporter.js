/**
 * @fileoverview Guitar Pro importer. Reads Guitar Pro files (.gp3, .gp4,
 * .gp5, .gpx, .gp) with alphaTab and maps one track onto the same
 * { sequences, annotations } model the ASCII tab parser produces, so the
 * OutputFormatter and everything downstream (save, My Tabs, sync) work
 * unchanged.
 *
 * This must remain the only module that imports @coderline/alphatab: app.js
 * loads it via dynamic import(), which keeps alphaTab in a lazy chunk that
 * users who never open a Guitar Pro file never download.
 * @module converter/importers/GuitarProImporter
 */

import * as alphaTab from '@coderline/alphatab';
import { TUNING_TEMPLATES, MAX_FRET } from '../../../utils/constants.js';
import { getOrdinalSuffix } from '../../../utils/helpers.js';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Standard tunings as pitch classes (MIDI % 12), highest string first.
 * Compared by pitch class because alphaTab stores written octaves that vary
 * by source format (a GP5 file and an alphaTex tuning differ by an octave).
 * @type {Object<number, number[]>}
 */
const STANDARD_TUNING_CLASSES = {
  4: [7, 2, 9, 4], // G D A E bass
  5: [7, 2, 9, 4, 11], // G D A E B bass
  6: [4, 11, 7, 2, 9, 4], // E B G D A E
  7: [4, 11, 7, 2, 9, 4, 11],
  8: [4, 11, 7, 2, 9, 4, 11, 6]
};

/** Spoken words for alphaTab's Duration enum values. */
const DURATION_WORDS = new Map([
  [-4, 'quadruple whole'],
  [-2, 'double whole'],
  [1, 'whole'],
  [2, 'half'],
  [4, 'quarter'],
  [8, 'eighth'],
  [16, 'sixteenth'],
  [32, 'thirty-second'],
  [64, 'sixty-fourth'],
  [128, 'one-hundred-twenty-eighth'],
  [256, 'two-hundred-fifty-sixth']
]);

/** Spoken words for common tuplet numerators. */
const TUPLET_WORDS = { 3: 'triplet', 5: 'quintuplet', 6: 'sextuplet', 7: 'septuplet', 9: 'nonuplet' };

/** Most timing-change annotations to list before summarizing the rest. */
const MAX_TIMING_CHANGES = 8;

/** Describe a fret as spoken text ("open string" / "5th fret"). */
function fretWord(fret) {
  return fret === 0 ? 'open string' : `${fret}${getOrdinalSuffix(fret)} fret`;
}

/**
 * Load a Guitar Pro score from raw file bytes.
 * @param {Uint8Array|ArrayBuffer} bytes - File contents
 * @returns {Object} alphaTab Score
 * @throws {Error} With a user-facing message when the file cannot be read
 */
export function loadScore(bytes) {
  try {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    return alphaTab.importer.ScoreLoader.loadScoreFromBytes(data, new alphaTab.Settings());
  } catch (error) {
    // Not only UnsupportedFormatError: truncated files surface reader errors.
    console.error('Guitar Pro import failed:', error);
    throw new Error(
      'This file could not be read as a Guitar Pro file. ' +
        'Supported types are .gp, .gp3, .gp4, .gp5 and .gpx.'
    );
  }
}

/**
 * The staff of a track that can be converted to tab, or null.
 * Percussion staves have no strings; grand-staff instruments (piano) have
 * no stringed staff at all.
 * @param {Object} track - alphaTab Track
 * @returns {Object|null} alphaTab Staff
 */
function convertibleStaff(track) {
  return track.staves.find(staff => staff.isStringed && !staff.isPercussion) || null;
}

/**
 * List the tracks of a score that can be converted (guitar, bass — anything
 * stringed and non-percussion).
 * @param {Object} score - alphaTab Score
 * @returns {Array<{index: number, name: string, stringCount: number}>} Tracks
 */
export function listConvertibleTracks(score) {
  const tracks = [];
  score.tracks.forEach((track, index) => {
    const staff = convertibleStaff(track);
    if (staff) {
      tracks.push({
        index,
        name: (track.name || '').trim(),
        stringCount: staff.tuning.length
      });
    }
  });
  return tracks;
}

/**
 * Title and artist of a score, for announcements and save-name prefills.
 * @param {Object} score - alphaTab Score
 * @returns {{title: string, artist: string}} Trimmed metadata
 */
export function describeScore(score) {
  return {
    title: (score.title || '').trim(),
    artist: (score.artist || '').trim()
  };
}

/**
 * Display names for each string, highest first, following the same rules as
 * the ASCII parser's stringName(): standard tunings use TUNING_TEMPLATES,
 * duplicated letters get low/high qualifiers (drop D → "low D").
 * @param {number[]} tuning - MIDI values, index 0 = highest string
 * @returns {{names: string[], letters: string[], isStandard: boolean}} Names
 */
function stringNames(tuning) {
  const count = tuning.length;
  const classes = tuning.map(midi => midi % 12);
  const letters = classes.map(pitchClass => NOTE_NAMES[pitchClass]);
  const standard = STANDARD_TUNING_CLASSES[count];

  if (standard && TUNING_TEMPLATES[count] && classes.every((c, i) => c === standard[i])) {
    return { names: TUNING_TEMPLATES[count], letters, isStandard: true };
  }

  const counts = {};
  for (const letter of letters) {
    counts[letter] = (counts[letter] || 0) + 1;
  }

  const names = letters.map((letter, index) => {
    if (counts[letter] > 1) {
      if (letters.lastIndexOf(letter) === index) return `low ${letter}`;
      if (letters.indexOf(letter) === index && letter === 'E') return 'high E';
      return letter;
    }
    if (letter === 'E') {
      if (index === 0) return 'high E';
      if (index === count - 1) return 'low E';
    }
    return letter;
  });

  return { names, letters, isStandard: false };
}

/**
 * Spoken duration of a beat ("eighth note", "dotted quarter rest",
 * "eighth note triplet").
 * @param {Object} beat - alphaTab Beat
 * @param {boolean} isRest - Speak "rest" instead of "note"
 * @returns {string} Spoken duration
 */
function spokenDuration(beat, isRest) {
  const base = DURATION_WORDS.get(beat.duration) || 'quarter';
  let phrase = `${base} ${isRest ? 'rest' : 'note'}`;

  if (beat.dots === 1) {
    phrase = `dotted ${phrase}`;
  } else if (beat.dots >= 2) {
    phrase = `double dotted ${phrase}`;
  }

  if (beat.hasTuplet) {
    const word = TUPLET_WORDS[beat.tupletNumerator];
    phrase += word
      ? ` ${word}`
      : `, ${beat.tupletNumerator} over ${beat.tupletDenominator} tuplet`;
  }

  return phrase;
}

/**
 * Map one alphaTab note's articulations onto the app's technique vocabulary.
 * techniques[] holds display names (what compact mode prints), details hold
 * { type, context, ... } objects (what verbose mode prints) — the same split
 * the ASCII parser produces.
 * @param {Object} note - alphaTab Note
 * @param {Object} beat - Owning alphaTab Beat
 * @returns {{techniques: string[], techniqueDetails: Array<Object>}} Mapping
 */
function mapTechniques(note, beat) {
  const model = alphaTab.model;
  const techniques = [];
  const techniqueDetails = [];

  const add = (type, displayName, context, extra = {}) => {
    if (!techniques.includes(displayName)) {
      techniques.push(displayName);
    }
    techniqueDetails.push({ type, context, ...extra });
  };

  // Hammer-on / pull-off: alphaTab marks the destination note and does not
  // distinguish the two — infer from fret direction like a player would.
  if (note.hammerPullOrigin) {
    const from = note.hammerPullOrigin.fret;
    const type = from > note.fret ? 'pull-off' : 'hammer-on';
    add(type, type, `${type} from ${fretWord(from)}`, { fromFret: from, toFret: note.fret });
  }

  // Bends. BendPoint.value is in quarter-tones, so 2 points = one fret.
  if (note.bendType !== model.BendType.None && note.bendPoints && note.bendPoints.length > 0) {
    const values = note.bendPoints.map(point => point.value);
    const peak = Math.max(...values);
    const final = values[values.length - 1];
    if (peak > 0) {
      const peakFret = note.fret + Math.round(peak / 2);
      const isPrebend =
        note.bendType === model.BendType.Prebend ||
        note.bendType === model.BendType.PrebendBend ||
        note.bendType === model.BendType.PrebendRelease;
      add('bend', 'bend',
        isPrebend ? `pre-bend toward ${fretWord(peakFret)}` : `bend up toward ${fretWord(peakFret)}`,
        { toFret: peakFret });
      if (final < peak) {
        const releaseFret = note.fret + Math.round(final / 2);
        add('release', 'release', `release back to ${fretWord(releaseFret)}`, {
          toFret: releaseFret
        });
      }
    }
  }

  switch (note.slideOutType) {
    case model.SlideOutType.Shift:
    case model.SlideOutType.Legato: {
      const target = note.slideTarget;
      if (target && target.fret > note.fret) {
        add('slide-up', 'slide up', `slide up to ${fretWord(target.fret)}`, { toFret: target.fret });
      } else if (target && target.fret < note.fret) {
        add('slide-down', 'slide down', `slide down to ${fretWord(target.fret)}`, {
          toFret: target.fret
        });
      } else if (target) {
        add('slide', 'slide', `slide to ${fretWord(target.fret)}`, { toFret: target.fret });
      } else {
        add('slide', 'slide', 'slide');
      }
      break;
    }
    case model.SlideOutType.OutUp:
      add('slide-up', 'slide up', 'slide up');
      break;
    case model.SlideOutType.OutDown:
      add('slide-down', 'slide down', 'slide down');
      break;
    case model.SlideOutType.PickSlideUp:
      add('slide-up', 'slide up', 'pick slide up');
      break;
    case model.SlideOutType.PickSlideDown:
      add('slide-down', 'slide down', 'pick slide down');
      break;
    default:
      break;
  }

  if (note.slideInType === model.SlideInType.IntoFromBelow) {
    add('slide', 'slide', 'slide into from below');
  } else if (note.slideInType === model.SlideInType.IntoFromAbove) {
    add('slide', 'slide', 'slide into from above');
  }

  const vibrato = note.vibrato !== model.VibratoType.None ? note.vibrato : beat.vibrato;
  if (vibrato === model.VibratoType.Wide) {
    add('vibrato', 'vibrato', 'wide vibrato');
  } else if (vibrato === model.VibratoType.Slight) {
    add('vibrato', 'vibrato', 'vibrato');
  }

  if (note.isGhost) {
    add('ghost note', 'ghost note', 'ghost note, played softly');
  }

  if (note.harmonicType && note.harmonicType !== model.HarmonicType.None) {
    const harmonicNames = new Map([
      [model.HarmonicType.Natural, 'harmonic'],
      [model.HarmonicType.Artificial, 'artificial harmonic'],
      [model.HarmonicType.Pinch, 'pinch harmonic'],
      [model.HarmonicType.Tap, 'tapped harmonic'],
      [model.HarmonicType.Semi, 'semi harmonic'],
      [model.HarmonicType.Feedback, 'feedback harmonic']
    ]);
    add('harmonic', 'harmonic', harmonicNames.get(note.harmonicType) || 'harmonic');
  }

  if (note.isPalmMute) add('palm mute', 'palm mute', 'palm muted');
  if (note.isLetRing) add('let ring', 'let ring', 'let ring');
  if (note.isStaccato) add('staccato', 'staccato', 'staccato');

  if (note.accentuated === model.AccentuationType.Heavy) {
    add('accent', 'accent', 'heavy accent');
  } else if (note.accentuated === model.AccentuationType.Normal) {
    add('accent', 'accent', 'accent');
  } else if (
    model.AccentuationType.Tenuto !== undefined &&
    note.accentuated === model.AccentuationType.Tenuto
  ) {
    add('tenuto', 'tenuto', 'tenuto');
  }

  if (beat.tap || note.isLeftHandTapped) {
    add('tap', 'tap', note.isLeftHandTapped ? 'left-hand tap' : 'tap');
  }
  if (beat.slap) add('slap', 'slap', 'slap');
  if (beat.pop) add('pop', 'pop', 'pop');

  if (note.isTieDestination) {
    add('tied', 'tied', 'tied from previous note, not picked again');
  }

  if (beat.graceType && beat.graceType !== model.GraceType.None) {
    add('grace note', 'grace note', 'grace note');
  }

  const tremolo = beat.tremoloSpeed ?? beat.tremoloPicking;
  if (tremolo !== null && tremolo !== undefined) {
    add('tremolo picking', 'tremolo picking', 'tremolo picking');
  }

  return { techniques, techniqueDetails };
}

/**
 * Map one alphaTab note to the app's Note shape, or null when the note
 * cannot be represented (impossible fret or string).
 * @param {Object} note - alphaTab Note
 * @param {Object} beat - Owning alphaTab Beat
 * @param {number} stringCount - Strings on the staff
 * @param {string[]} names - Display names, index 0 = highest string
 * @returns {Object|null} App note
 */
function mapNote(note, beat, stringCount, names) {
  // alphaTab counts note.string from 1 = LOWEST string, while staff.tuning
  // (and our stringIndex) start at the highest string — see alphaTab
  // Staff.ts: "The first item is the most top tablature line". Do not
  // "simplify" this into note.string - 1.
  const stringIndex = stringCount - note.string;
  if (stringIndex < 0 || stringIndex >= stringCount) {
    console.warn(`Skipping note on out-of-range string ${note.string}`);
    return null;
  }

  let fret;
  if (note.isDead) {
    fret = 'mute';
  } else if (Number.isInteger(note.fret) && note.fret >= 0 && note.fret <= MAX_FRET) {
    fret = note.fret;
  } else {
    console.warn(`Skipping impossible fret number ${note.fret}`);
    return null;
  }

  const { techniques, techniqueDetails } = mapTechniques(note, beat);

  return {
    string: names[stringIndex],
    stringIndex,
    fret,
    techniques,
    techniqueDetails,
    duration: spokenDuration(beat, false),
    position: beat.absoluteDisplayStart
  };
}

/**
 * Build the annotation list (song, timing, instructions) for a score/staff.
 * @param {Object} score - alphaTab Score
 * @param {Object} staff - Converted alphaTab Staff
 * @param {string[]} letters - Plain note letters, highest string first
 * @param {boolean} isStandard - Whether the tuning is standard
 * @returns {Array<Object>} Annotations
 */
function buildAnnotations(score, staff, letters, isStandard) {
  const annotations = [];
  const push = (text, category) => annotations.push({ text, lineNumber: 0, category });

  const { title, artist } = describeScore(score);
  if (title && artist) {
    push(`"${title}" by ${artist}`, 'song');
  } else if (title) {
    push(`"${title}"`, 'song');
  } else if (artist) {
    push(`by ${artist}`, 'song');
  }

  const masterBars = score.masterBars;
  const first = masterBars[0];
  const tempoLabel = (score.tempoLabel || '').trim();
  push(`Tempo: ${score.tempo} BPM${tempoLabel ? ` (${tempoLabel})` : ''}`, 'timing');
  if (first) {
    push(`Time signature: ${first.timeSignatureNumerator}/${first.timeSignatureDenominator}`, 'timing');
  }

  // Mid-song tempo and time signature changes, capped so a 200-bar epic
  // does not drown the summary.
  const changes = [];
  for (let i = 1; i < masterBars.length; i++) {
    const bar = masterBars[i];
    const previous = masterBars[i - 1];
    if (
      bar.timeSignatureNumerator !== previous.timeSignatureNumerator ||
      bar.timeSignatureDenominator !== previous.timeSignatureDenominator
    ) {
      changes.push(
        `Time signature changes to ${bar.timeSignatureNumerator}/${bar.timeSignatureDenominator} at measure ${i + 1}`
      );
    }
    if (bar.tempoAutomations.length > 0) {
      changes.push(`Tempo changes to ${bar.tempoAutomations[0].value} BPM at measure ${i + 1}`);
    }
  }
  for (const text of changes.slice(0, MAX_TIMING_CHANGES)) {
    push(text, 'timing');
  }
  if (changes.length > MAX_TIMING_CHANGES) {
    push(`And ${changes.length - MAX_TIMING_CHANGES} more timing changes`, 'timing');
  }

  if (staff.capo > 0) {
    push(`Capo on ${staff.capo}${getOrdinalSuffix(staff.capo)} fret`, 'instruction');
  }

  if (!isStandard) {
    push(`Tuning, low string to high: ${[...letters].reverse().join(' ')}`, 'instruction');
  }

  // Repeats: a bar with repeatCount > 0 closes the span opened by the most
  // recent repeat-start bar (or the beginning of the song).
  let repeatStart = 0;
  for (let i = 0; i < masterBars.length; i++) {
    const bar = masterBars[i];
    if (bar.isRepeatStart) {
      repeatStart = i;
    }
    if (bar.repeatCount > 0) {
      const span =
        repeatStart === i
          ? `Measure ${i + 1} repeats`
          : `Measures ${repeatStart + 1} to ${i + 1} repeat`;
      push(`${span}, play ${bar.repeatCount} times`, 'instruction');
    }
  }

  return annotations;
}

/**
 * Convert one track of a score into the app's tab model.
 * @param {Object} score - alphaTab Score
 * @param {number} trackIndex - Index into score.tracks
 * @returns {{sequences: Array<Object>, annotations: Array<Object>}} Tab data
 * @throws {Error} When the track has no stringed staff
 */
export function trackToTabData(score, trackIndex) {
  const track = score.tracks[trackIndex];
  const staff = track ? convertibleStaff(track) : null;
  if (!staff) {
    throw new Error('This track has no guitar or bass tab to convert.');
  }

  const stringCount = staff.tuning.length;
  const { names, letters, isStandard } = stringNames(staff.tuning);

  const sequences = [];
  const annotations = buildAnnotations(score, staff, letters, isStandard);
  let current = null;

  for (let barIndex = 0; barIndex < staff.bars.length; barIndex++) {
    const masterBar = score.masterBars[barIndex];

    if (!current || (masterBar.section && masterBar.isSectionStart)) {
      const section = masterBar.section;
      const heading = section ? (section.text || section.marker || '').trim() || null : null;
      current = {
        section: sequences.length + 1,
        heading,
        measureCount: 0,
        stringCount,
        notes: []
      };
      sequences.push(current);
      if (heading) {
        annotations.push({ text: heading, lineNumber: 0, category: 'section' });
      }
    }
    current.measureCount++;

    // Merge the beats of every voice in this bar by their start tick, so
    // two-voice fingerstyle writing becomes one chronological event stream.
    const eventsByTick = new Map();
    for (const voice of staff.bars[barIndex].voices) {
      if (voice.isEmpty) continue;
      for (const beat of voice.beats) {
        if (beat.isEmpty) continue;
        const tick = beat.absoluteDisplayStart;
        let entry = eventsByTick.get(tick);
        if (!entry) {
          entry = { notes: [], restBeat: null };
          eventsByTick.set(tick, entry);
        }
        if (beat.isRest) {
          // Only the main voice's rests are meaningful pauses; other
          // voices are padded with structural rests.
          if (voice.index === 0 && !entry.restBeat) {
            entry.restBeat = beat;
          }
          continue;
        }
        for (const note of beat.notes) {
          const mapped = mapNote(note, beat, stringCount, names);
          if (mapped) {
            entry.notes.push(mapped);
          }
        }
      }
    }

    const ticks = [...eventsByTick.keys()].sort((a, b) => a - b);
    for (const tick of ticks) {
      const entry = eventsByTick.get(tick);
      if (entry.notes.length > 0) {
        entry.notes.sort((a, b) => a.stringIndex - b.stringIndex);
        current.notes.push({
          position: tick,
          // Absolute measure numbers across the whole song — how players
          // reference bars — rather than restarting per section.
          measure: barIndex + 1,
          isChord: entry.notes.length > 1,
          notes: entry.notes
        });
      } else if (entry.restBeat) {
        current.notes.push({
          position: tick,
          measure: barIndex + 1,
          isChord: false,
          isRest: true,
          duration: spokenDuration(entry.restBeat, true),
          notes: []
        });
      }
    }
  }

  return { sequences, annotations };
}
