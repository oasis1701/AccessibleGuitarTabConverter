/**
 * @fileoverview Formatter for converting parsed tab data to accessible text
 * @module converter/formatters/OutputFormatter
 */

import { getOrdinalSuffix } from '../../../utils/helpers.js';

/** String names per chart size, listed LOW string first — the order chord
 * charts like "Am: X-0-2-2-1-0" are conventionally written in. */
const CHART_STRING_NAMES = {
  6: ['low E', 'A', 'D', 'G', 'B', 'high E'],
  7: ['low B', 'low E', 'A', 'D', 'G', 'B', 'high E'],
  8: ['F#', 'low B', 'low E', 'A', 'D', 'G', 'B', 'high E']
};

/**
 * Class to format parsed tab data into accessible text
 */
export class OutputFormatter {
  /**
   * Format a chord chart into accessible text.
   * Fret lists are read low string first, matching how chord charts
   * are written (X-0-2-2-1-0 mutes the low E, not the high E).
   * @param {Array<Object>} chords - Parsed chords
   * @param {Object} settings - Formatting settings
   * @returns {string} Formatted chord chart
   */
  formatChordChart(chords, settings) {
    let output = 'Chord Chart:\n\n';

    for (const chord of chords) {
      const stringCount = chord.frets.length;
      const names = CHART_STRING_NAMES[stringCount];
      output += `${chord.name} chord (${stringCount}-string):\n`;

      for (let i = 0; i < stringCount; i++) {
        const stringName = settings.useStringNames && names
          ? names[i]
          : `String ${stringCount - i}`;

        const fret = chord.frets[i];

        if (fret === 'mute') {
          output += `- ${stringName}: muted\n`;
        } else if (fret === 0) {
          output += `- ${stringName}: open\n`;
        } else {
          output += `- ${stringName}: ${fret}${getOrdinalSuffix(fret)} fret\n`;
        }
      }

      output += '\n';
    }

    return output.trim();
  }

  /**
   * Format tablature data into accessible text
   * @param {Object} tabData - Parsed tab data
   * @param {Object} settings - Formatting settings
   * @returns {string} Formatted tablature
   */
  formatTablature(tabData, settings) {
    const { sequences, annotations } = tabData;

    if (sequences.length === 0) {
      return 'No notes found in the tab. Please make sure your tab is properly formatted.';
    }

    let output = '';

    const annotationSummary = this.summarizeAnnotations(annotations);
    if (annotationSummary && settings.includeTiming) {
      output += annotationSummary + '\n\n';
    }

    for (const sequence of sequences) {
      output += this.formatSequence(sequence, settings) + '\n';
    }

    return output.trim();
  }

  /**
   * Format a single sequence of notes
   * @param {Object} sequence - Note sequence
   * @param {Object} settings - Formatting settings
   * @returns {string} Formatted sequence
   * @private
   */
  formatSequence(sequence, settings) {
    let header = `Section ${sequence.section}`;
    if (settings.includeTiming && sequence.heading) {
      header += ` (${sequence.heading})`;
    }
    if (sequence.measureCount >= 2) {
      header += `, ${sequence.measureCount} measures`;
    }

    let output = header + ':\n';
    const useMeasureHeaders = sequence.measureCount >= 2;
    let currentMeasure = 0;

    for (const event of sequence.notes) {
      if (useMeasureHeaders && event.measure !== currentMeasure) {
        currentMeasure = event.measure;
        output += `\nMeasure ${currentMeasure}:\n`;
      }

      if (event.isChord) {
        output += this.formatChord(event.notes, settings);
      } else {
        for (const note of event.notes) {
          output += this.formatNote(note, settings);
        }
      }
    }

    return output;
  }

  /**
   * Spoken name for a string ("high E string", "String 7").
   * @param {Object} note - Note with string name and index
   * @param {Object} settings - Formatting settings
   * @returns {string} String description
   * @private
   */
  stringLabel(note, settings) {
    if (!settings.useStringNames) {
      return `String ${note.stringIndex + 1}`;
    }
    return note.string.startsWith('String')
      ? note.string
      : `${note.string} string`;
  }

  /**
   * Spoken fret description ("open", "muted", "12th fret").
   * @param {number|string} fret - Fret value
   * @returns {string} Fret description
   * @private
   */
  fretLabel(fret) {
    if (fret === 'mute') return 'muted';
    if (fret === 0) return 'open';
    return `${fret}${getOrdinalSuffix(fret)} fret`;
  }

  /**
   * Technique suffix for a note, or an empty string.
   * @param {Object} note - Note with techniques and details
   * @param {Object} settings - Formatting settings
   * @returns {string} Technique text
   * @private
   */
  techniqueLabel(note, settings) {
    if (!settings.includeTechniqueDetails || !note.techniques || note.techniques.length === 0) {
      return '';
    }

    if (settings.verboseMode) {
      const contexts = (note.techniqueDetails && note.techniqueDetails.length > 0
        ? note.techniqueDetails.map(detail => detail.context || detail.type)
        : note.techniques
      ).filter(Boolean);
      return ` (${contexts.join(', ')})`;
    }

    return ` ${note.techniques.join('+')}`;
  }

  /**
   * Format a single note
   * @param {Object} note - Note to format
   * @param {Object} settings - Formatting settings
   * @returns {string} Formatted note line
   * @private
   */
  formatNote(note, settings) {
    return (
      `- ${this.stringLabel(note, settings)}, ${this.fretLabel(note.fret)}` +
      this.techniqueLabel(note, settings) +
      '\n'
    );
  }

  /**
   * Format a chord (multiple simultaneous notes)
   * @param {Array<Object>} notes - Notes in the chord, high string first
   * @param {Object} settings - Formatting settings
   * @returns {string} Formatted chord line
   * @private
   */
  formatChord(notes, settings) {
    let chordDesc = '- Chord: ';

    if (settings.verboseMode) {
      chordDesc += notes
        .map(note => `${this.stringLabel(note, settings)} ${this.fretLabel(note.fret)}`)
        .join(', ');
    } else {
      const fretPattern = notes
        .map(note => (note.fret === 'mute' ? 'x' : note.fret))
        .join('-');
      chordDesc += `(${fretPattern})`;
    }

    if (settings.includeTechniqueDetails) {
      const seen = new Set();
      const techniqueTexts = [];
      for (const note of notes) {
        const label = this.techniqueLabel(note, settings).trim();
        if (label && !seen.has(label)) {
          seen.add(label);
          techniqueTexts.push(label.replace(/^\(|\)$/g, ''));
        }
      }
      if (techniqueTexts.length > 0) {
        chordDesc += ` with ${techniqueTexts.join(', ')}`;
      }
    }

    return chordDesc + '\n';
  }

  /**
   * Summarize annotations by category
   * @param {Array<Object>} annotations - All annotations
   * @returns {string} Annotation summary
   * @private
   */
  summarizeAnnotations(annotations) {
    if (!annotations || annotations.length === 0) return '';

    const categories = {};

    for (const annotation of annotations) {
      if (!categories[annotation.category]) {
        categories[annotation.category] = [];
      }
      if (!categories[annotation.category].includes(annotation.text)) {
        categories[annotation.category].push(annotation.text);
      }
    }

    let summary = 'Tab Information:';

    if (categories.section) {
      summary += `\n- Sections: ${categories.section.join(', ')}`;
    }

    if (categories.timing) {
      summary += `\n- Timing: ${categories.timing.join(', ')}`;
    }

    if (categories.chords) {
      summary += `\n- Chord progression: ${categories.chords.join(', ')}`;
    }

    if (categories.instruction) {
      summary += `\n- Instructions: ${categories.instruction.join(', ')}`;
    }

    if (categories.lyrics) {
      summary += '\n- Contains lyrics';
    }

    // Nothing beyond the bare heading means only uncategorized notes exist.
    return summary === 'Tab Information:' ? '' : summary;
  }
}
