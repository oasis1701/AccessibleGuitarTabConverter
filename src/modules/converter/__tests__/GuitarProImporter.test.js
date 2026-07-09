import { describe, it, expect } from 'vitest';
import * as alphaTab from '@coderline/alphatab';
import {
  loadScore,
  listConvertibleTracks,
  describeScore,
  trackToTabData
} from '../importers/GuitarProImporter.js';

/**
 * Build a real alphaTab Score from alphaTex markup, so tests exercise the
 * same model objects the file importers produce — no binary fixtures needed.
 * In alphaTex note syntax (fret.string.duration), string 1 is the HIGHEST
 * string; alphaTab's model inverts that internally, which is exactly what
 * the importer has to undo.
 */
function scoreFromTex(tex) {
  const importer = new alphaTab.importer.AlphaTexImporter();
  importer.initFromString(tex, new alphaTab.Settings());
  return importer.readScore();
}

function tabDataFromTex(tex, trackIndex = 0) {
  return trackToTabData(scoreFromTex(tex), trackIndex);
}

function allNotes(tabData) {
  return tabData.sequences.flatMap(sequence =>
    sequence.notes.flatMap(event => event.notes)
  );
}

describe('trackToTabData: strings and frets', () => {
  it('maps alphaTab string numbers onto stringIndex 0 = highest string', () => {
    const { sequences } = tabDataFromTex('3.3.4 5.4.8 0.1.2');
    const notes = allNotes({ sequences });

    expect(notes).toHaveLength(3);
    // alphaTex string 3 = G string = our index 2
    expect(notes[0]).toMatchObject({ string: 'G', stringIndex: 2, fret: 3 });
    expect(notes[1]).toMatchObject({ string: 'D', stringIndex: 3, fret: 5 });
    expect(notes[2]).toMatchObject({ string: 'high E', stringIndex: 0, fret: 0 });
  });

  it('speaks beat durations on every note', () => {
    const { sequences } = tabDataFromTex('3.3.4 5.4.8 0.1.2');
    const notes = allNotes({ sequences });

    expect(notes.map(n => n.duration)).toEqual([
      'quarter note',
      'eighth note',
      'half note'
    ]);
  });

  it('groups simultaneous notes into a chord sorted high string first', () => {
    const { sequences } = tabDataFromTex('(3.3 5.4 5.5).8');
    const events = sequences[0].notes;

    expect(events).toHaveLength(1);
    expect(events[0].isChord).toBe(true);
    expect(events[0].notes.map(n => n.stringIndex)).toEqual([2, 3, 4]);
    expect(events[0].notes[0].duration).toBe('eighth note');
  });

  it('turns dead notes into muted frets', () => {
    const { sequences } = tabDataFromTex('x.3.4');
    const notes = allNotes({ sequences });

    expect(notes[0].fret).toBe('mute');
  });
});

describe('trackToTabData: sections and measures', () => {
  it('splits sequences at section markers with absolute measure numbers', () => {
    const { sequences, annotations } = tabDataFromTex(
      '\\section "Intro" 1.1 1.1 1.1 1.1 | 2.1 2.1 2.1 2.1 | \\section "Verse" 3.1 3.1 3.1 3.1'
    );

    expect(sequences).toHaveLength(2);
    expect(sequences[0]).toMatchObject({ section: 1, heading: 'Intro', measureCount: 2 });
    expect(sequences[1]).toMatchObject({ section: 2, heading: 'Verse', measureCount: 1 });

    // Measure numbers keep counting across sections, like players do.
    expect(sequences[1].notes[0].measure).toBe(3);

    const sectionAnnotations = annotations.filter(a => a.category === 'section');
    expect(sectionAnnotations.map(a => a.text)).toEqual(['Intro', 'Verse']);
  });

  it('produces a single heading-less sequence when the file has no sections', () => {
    const { sequences } = tabDataFromTex('3.3 | 5.3');

    expect(sequences).toHaveLength(1);
    expect(sequences[0].heading).toBeNull();
    expect(sequences[0].measureCount).toBe(2);
    expect(sequences[0].notes[1].measure).toBe(2);
  });

  it('merges multiple voices into one chronological event stream', () => {
    const { sequences } = tabDataFromTex('\\track "FS" \\staff{tabs} \\voice 0.1.4 0.1.4 \\voice 3.6.2');
    const events = sequences[0].notes;

    expect(events).toHaveLength(2);
    expect(events[0].isChord).toBe(true);
    expect(events[0].notes.map(n => [n.stringIndex, n.fret])).toEqual([
      [0, 0],
      [5, 3]
    ]);
    expect(events[1].isChord).toBe(false);
  });

  it('emits rest events with spoken durations', () => {
    const { sequences } = tabDataFromTex('3.3.4 r.8 5.3.4');
    const events = sequences[0].notes;

    expect(events).toHaveLength(3);
    expect(events[1].isRest).toBe(true);
    expect(events[1].duration).toBe('eighth rest');
    expect(events[1].notes).toEqual([]);
  });
});

describe('trackToTabData: techniques', () => {
  it('infers hammer-on vs pull-off from fret direction', () => {
    const { sequences } = tabDataFromTex(':8 5.3{h} 7.3 7.3{h} 5.3');
    const notes = allNotes({ sequences });

    const hammer = notes[1].techniqueDetails.find(d => d.type === 'hammer-on');
    expect(hammer).toMatchObject({ fromFret: 5, toFret: 7, context: 'hammer-on from 5th fret' });

    const pull = notes[3].techniqueDetails.find(d => d.type === 'pull-off');
    expect(pull).toMatchObject({ fromFret: 7, toFret: 5, context: 'pull-off from 7th fret' });
  });

  it('converts bend points from quarter-tones to target frets', () => {
    const { sequences } = tabDataFromTex('3.3{b (0 4)} 3.3{b (0 2)}');
    const notes = allNotes({ sequences });

    const fullBend = notes[0].techniqueDetails.find(d => d.type === 'bend');
    expect(fullBend).toMatchObject({ toFret: 5, context: 'bend up toward 5th fret' });

    const halfBend = notes[1].techniqueDetails.find(d => d.type === 'bend');
    expect(halfBend).toMatchObject({ toFret: 4 });
  });

  it('adds a release when a bend curve ends below its peak', () => {
    const { sequences } = tabDataFromTex('3.3{b (0 4 0)}');
    const [note] = allNotes({ sequences });

    expect(note.techniqueDetails.find(d => d.type === 'bend')).toMatchObject({ toFret: 5 });
    expect(note.techniqueDetails.find(d => d.type === 'release')).toMatchObject({
      toFret: 3,
      context: 'release back to 3rd fret'
    });
  });

  it('describes slides with their target frets', () => {
    const up = allNotes(tabDataFromTex('3.3{ss} 5.3'));
    expect(up[0].techniqueDetails.find(d => d.type === 'slide-up')).toMatchObject({
      toFret: 5,
      context: 'slide up to 5th fret'
    });

    const down = allNotes(tabDataFromTex('7.3{sl} 5.3'));
    expect(down[0].techniqueDetails.find(d => d.type === 'slide-down')).toMatchObject({
      toFret: 5,
      context: 'slide down to 5th fret'
    });

    const out = allNotes(tabDataFromTex('3.3{sou}'));
    expect(out[0].techniqueDetails.find(d => d.type === 'slide-up')).toMatchObject({
      context: 'slide up'
    });
  });

  it('maps ghost notes, harmonics, palm mutes, let ring, vibrato and ties', () => {
    const notes = allNotes(
      tabDataFromTex('3.3{g} 12.3{nh} 5.6{pm} 3.2{lr} 5.3{v} 3.3.4 -.3.4')
    );

    expect(notes[0].techniqueDetails[0]).toMatchObject({
      type: 'ghost note',
      context: 'ghost note, played softly'
    });
    expect(notes[1].techniques).toContain('harmonic');
    expect(notes[2].techniques).toContain('palm mute');
    expect(notes[2].techniqueDetails[0].context).toBe('palm muted');
    expect(notes[3].techniques).toContain('let ring');
    expect(notes[4].techniques).toContain('vibrato');
    expect(notes[6].techniqueDetails[0]).toMatchObject({
      type: 'tied',
      context: 'tied from previous note, not picked again'
    });
  });

  it('keeps technique display names aligned with the ASCII parser', () => {
    const notes = allNotes(tabDataFromTex('3.3{ss} 5.3'));
    // techniques[] carries display names ("slide up"), details carry types.
    expect(notes[0].techniques).toContain('slide up');
    expect(notes[0].techniques).not.toContain('slide-up');
  });
});

describe('trackToTabData: durations', () => {
  it('speaks dots and tuplets', () => {
    const { sequences } = tabDataFromTex('3.3.4{d} 3.3.8{tu 3} r.4{d}');
    const events = sequences[0].notes;

    expect(events[0].notes[0].duration).toBe('dotted quarter note');
    expect(events[1].notes[0].duration).toBe('eighth note triplet');
    expect(events[2].duration).toBe('dotted quarter rest');
  });
});

describe('trackToTabData: annotations', () => {
  it('collects song, tempo, time signature and repeats', () => {
    const { annotations } = tabDataFromTex(
      '\\title "Song" \\artist "Band" \\tempo 90 . \\ts 3 4 \\ro 1.1 1.1 1.1 | \\rc 2 2.1 2.1 2.1'
    );

    const byCategory = category =>
      annotations.filter(a => a.category === category).map(a => a.text);

    expect(byCategory('song')).toEqual(['"Song" by Band']);
    expect(byCategory('timing')).toContain('Tempo: 90 BPM');
    expect(byCategory('timing')).toContain('Time signature: 3/4');
    expect(byCategory('instruction')).toContain('Measures 1 to 2 repeat, play 2 times');
  });

  it('reports capo and non-standard tunings', () => {
    const { annotations, sequences } = tabDataFromTex(
      '\\track "Drop" \\staff{tabs} \\capo 2 \\tuning e5 b4 g4 d4 a3 d3 . 0.6.4'
    );

    const instructions = annotations.filter(a => a.category === 'instruction').map(a => a.text);
    expect(instructions).toContain('Capo on 2nd fret');
    expect(instructions).toContain('Tuning, low string to high: D A D G B E');

    // Drop D: the lowest string is named low D, the top one stays high E.
    expect(sequences[0].notes[0].notes[0].string).toBe('low D');
  });

  it('uses standard string names when the tuning matches, regardless of octave', () => {
    // alphaTex tunings are written an octave above the GP binary presets;
    // detection must compare pitch classes, not raw MIDI numbers.
    const { sequences } = tabDataFromTex(
      '\\track "Std" \\staff{tabs} \\tuning e5 b4 g4 d4 a3 e3 . 0.1 0.6'
    );
    const notes = allNotes({ sequences });

    expect(notes[0].string).toBe('high E');
    expect(notes[1].string).toBe('low E');
  });
});

describe('score-level helpers', () => {
  it('lists only stringed, non-percussion tracks', () => {
    const score = scoreFromTex(
      '\\track "Guitar" \\staff{tabs} 3.3 | \\track "Drums" \\instrument percussion \\staff{score} r.1 | \\track "Keys" \\instrument piano \\staff{score} c4'
    );

    const tracks = listConvertibleTracks(score);
    expect(tracks).toHaveLength(1);
    expect(tracks[0]).toMatchObject({ index: 0, name: 'Guitar', stringCount: 6 });
  });

  it('describes title and artist for announcements', () => {
    const score = scoreFromTex('\\title "Song" \\artist "Band" . 3.3');
    expect(describeScore(score)).toEqual({ title: 'Song', artist: 'Band' });
  });

  it('round-trips a real Guitar Pro file through loadScore', () => {
    const original = scoreFromTex('\\title "RT" . \\section "Intro" 3.3.4 5.4.8 | (3.3 5.4).4');
    const bytes = new alphaTab.exporter.Gp7Exporter().export(original, new alphaTab.Settings());

    const score = loadScore(new Uint8Array(bytes));
    const { sequences, annotations } = trackToTabData(score, 0);

    expect(annotations.find(a => a.category === 'song').text).toBe('"RT"');
    expect(sequences[0].heading).toBe('Intro');
    expect(allNotes({ sequences }).map(n => n.fret)).toEqual([3, 5, 3, 5]);
  });

  it('throws a plain-language error for unreadable bytes', () => {
    expect(() => loadScore(new Uint8Array([1, 2, 3, 4]))).toThrow(
      /could not be read as a Guitar Pro file/
    );
  });
});
