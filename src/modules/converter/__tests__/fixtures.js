/**
 * @fileoverview Tab fixtures for parser and converter tests.
 * Migrated from the old test-tabs.js manual harness, plus one fixture per
 * confirmed parser bug from the 2026 overhaul.
 */

// --- Migrated from test-tabs.js ---

// E and B string ambiguity (mixed-case labels)
export const ambiguousStringTest = `
e|---0---1---3---0---|
B|---1---1---0---1---|
G|---0---2---0---0---|
D|---2---3---0---2---|
A|---3---3---2---3---|
E|-------1---3-------|
`;

// 7-string with low B
export const sevenStringTest = `
e|---0---1---3---0---|
B|---1---1---0---1---|
G|---0---2---0---0---|
D|---2---3---0---2---|
A|---3---3---2---3---|
E|-------1---3-------|
B|---0-------2---0---|
`;

// Muted notes and open strings (x and o notation)
export const mutedNotesTest = `
e|---x---1---3---o---|
B|---1---x---0---1---|
G|---0---2---x---0---|
D|---2---3---0---2---|
A|---x---3---2---x---|
E|-------x---3---o---|
`;

// Extended techniques: hammer/pull chains, bend/release, vibrato, slides
export const techniquesTest = `
e|---0h1p0---3b5r3---0~/3\\0---|
B|---1-------0-------1---------|
G|---0-------0-------0---------|
D|---2-------0-------2---------|
A|---3-------2-------3---------|
E|-----------3-----------------|
`;

// Ghost notes, harmonics, taps
export const advancedTechniquesTest = `
e|---(5)---<12>---15t---|
B|---6-----<7>----16t---|
G|---(5)---<5>----15----|
D|---7-----<7>----17----|
A|---7-----<5>----17----|
E|---5------------------|
`;

// Invalid fret numbers (99 should be filtered out)
export const invalidFretsTest = `
e|---0---99---3---0---|
B|---1---1----0---1---|
G|---0---2----0---0---|
D|---2---3----0---2---|
A|---3---3----2---3---|
E|-------1----3-------|
`;

// --- Bug-repro fixtures ---

// Multi-digit frets must parse once (12 is one note, not 12 then 2)
export const multiDigitTest = `
e|---12---------|
B|--------12-2--|
G|--------------|
D|--------------|
A|--------------|
E|---10---------|
`;

// All-lowercase string labels (very common on tab sites)
export const lowercaseLabelsTest = `
e|--3--5--|
b|--3--5--|
g|--0--0--|
d|--------|
a|--------|
e|--------|
`;

// Drop-D tuning: two D strings, none may be dropped or collide
export const dropDTest = `
e|--0---------|
B|--3---------|
G|--2---------|
D|--0---------|
A|--0---------|
D|--0---------|
`;

// Low-to-high string order (inverted): must be flipped, not mislabeled
export const invertedOrderTest = `
E|--0---------|
A|--2---------|
D|--2---------|
G|--1---------|
B|--0---------|
e|--0---------|
`;

// Unknown label (drop C style): string must be kept, named C
export const dropCTest = `
e|--0--|
B|--0--|
G|--0--|
D|--0--|
A|--0--|
C|--3--|
`;

// Two 6-line blocks separated by a blank line = two sections, never one 8-string blob
export const twoSectionsTest = `
|--3--5--|
|--3--5--|
|--0--0--|
|--------|
|--------|
|--------|

|--7--8--|
|--7--8--|
|--0--0--|
|--------|
|--------|
|--------|
`;

// Bare tab lines: no labels, no leading pipes
export const bareLinesTest = `
---0---3---
---1---0---
---0---0---
---2---0---
---3---2---
-----------
`;

// 4-string bass tab
export const bassTest = `
G|--------------|
D|--------------|
A|--3--3--5--5--|
E|--------------|
`;

// Mixed-width labels: F# label is wider than e; chords must stay aligned
export const mixedWidthLabelsTest = `
e|--3--|
B|--3--|
G|--0--|
D|--0--|
A|--2--|
E|--3--|
F#|--3--|
`;

// Spaced label separator style from the landing page example
export const spacedSeparatorTest = `
E :----------15h16---15----|
B :---18r------------------|
G :------------------------|
`;

// Measures: two bars split by an interior bar line
export const measuresTest = `[Intro]
e|--0--12--|--3--|
B|--1--12--|--0--|
G|--2--12--|--0--|
D|---------|-----|
A|---------|-----|
E|--0------|--3--|
`;

// Section heading above the block
export const headingTest = `Verse 1
e|--5--|
B|--5--|
G|--0--|
D|-----|
A|-----|
E|-----|
`;

// 8-string tab (labeled, high to low)
export const eightStringTest = `
e|--0--|
B|--1--|
G|--0--|
D|--2--|
A|--3--|
E|--0--|
B|--2--|
F#|--0--|
`;

// Chord chart format
export const chordChartTest = `F: 1-3-3-2-1-1
Am: X-0-2-2-1-0
C: 0-1-0-2-3-X
`;

// Standalone technique chars must not invent notes or bind to labels
export const strayTechniqueTest = `
e|----~----|
b|--3------|
g|---------|
d|---------|
a|---------|
e|---------|
`;

// A legend/key block that must not be parsed as music
export const legendTest = `
e|--5h7--|
B|-------|
G|-------|
D|-------|
A|-------|
E|-------|

| h  Hammer-on
| p  Pull-off
`;

// Plain text that is not a tab at all
export const notATabTest = `Dear diary,
today I practiced arpeggios for an hour.
Tomorrow: sweep picking.
`;
