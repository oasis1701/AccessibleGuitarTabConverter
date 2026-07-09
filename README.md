# Accessible Guitar Tab Converter

A web app that converts ASCII guitar tablature and Guitar Pro files into screen-reader-friendly text. Built by and for blind guitarists: instead of a visual grid of dashes and numbers, you get sequential descriptions like:

```
Section 1 (Intro), 2 measures:

Measure 1:
- Chord: high E string open, B string 1st fret, G string 2nd fret, low E string open
- high E string, 7th fret (hammer-on from 5th fret)

Measure 2:
- high E string, 12th fret (bend up toward 14th fret)
```

Live site: https://oasis1701.github.io/AccessibleGuitarTabConverter/

## Using the app

1. Open **converter.html** (the "New Tab Conversion" link on the home page).
2. Paste a plain-text guitar tab into the input box, or use **Or Import a Guitar Pro File** to open a `.gp`, `.gp3`, `.gp4`, `.gp5` or `.gpx` file.
3. Press the **Convert** button (or Control+Enter). There is one Convert button and it always converts whatever you used last — its label says which: "Convert Tab to Accessible Format" for pasted text, "Convert Selected Guitar Pro Track" while a file is active. Guitar Pro files with one guitar or bass track convert as soon as they load; files with several tracks land focus on a track list — pick a track and press Enter to convert it. You can convert another track from the same file without reopening it.
4. Focus moves to the read-only output box; arrow through it line by line.
5. **Save Tab** (Control+S) stores it in your browser; **Copy to Clipboard** (Control+Shift+C) copies the result.
6. **My Tabs** lists saved tabs in a table with Open, Delete and Export actions.

### Guitar Pro import

- Reads all common Guitar Pro formats — `.gp3`, `.gp4`, `.gp5`, `.gpx` (Guitar Pro 6) and `.gp` (Guitar Pro 7/8) — using the [alphaTab](https://alphatab.net) music engine (MPL-2.0), which is loaded on demand the first time you open a file. Files are read entirely on your device; nothing is uploaded.
- Drum and other non-stringed tracks are filtered out of the track picker.
- Guitar Pro files carry more information than ASCII tabs, and the output uses it: song title and artist, real section names, tempo and time-signature changes, capo, non-standard tunings, repeats ("Measures 5 to 8 repeat, play 2 times"), rests, and exact note durations ("B string, 5th fret, eighth note").
- Saving an imported tab stores the converted text plus a note about which file and track it came from; the binary file itself is never stored, so reopening a saved import shows the text without a re-convert option.

### What the parser understands

- Labeled tabs in any case (`e|`, `B|`, `g|`, `E :`), including drop and alternate tunings (`D|`, `C|`, `F#|`) — string labels are kept, duplicates become "D" and "low D"
- Unlabeled tabs (`|---0---|`) and bare lines (`---0---3---`)
- 4- and 5-string bass, 6-, 7- and 8-string guitar; tabs written low-string-first are flipped automatically
- Multi-digit frets, muted notes (`x`), open strings (`0` or `o`), ghost notes `(5)`, harmonics `<12>`
- Techniques bound to their notes: `5h7` "hammer-on from 5th fret", `12b14` "bend up toward 14th fret", `3b5r3`, slides `/ \ s`, vibrato `~`, taps, staccato, accents
- Bar lines become measure numbers so you can navigate a riff bar by bar
- Chord charts like `Am: X-0-2-2-1-0` (read low string first, as written)
- Section labels like `[Intro]` or `Verse 1` become section headings in the output

### Output settings

Five checkboxes on the converter page, all on by default:

- **Include annotations** — tab information summary and section names
- **Verbose descriptions** — full sentences vs. compact `(3-1-0-2-3-x)` chord patterns
- **Use string names** — "high E string" vs. "1st string" (string 1 is the high E, as guitarists count)
- **Detailed techniques** — technique descriptions on each note
- **Include note durations** — spoken rhythm ("eighth note", "dotted quarter rest") on Guitar Pro imports; pasted ASCII tabs carry no rhythm, so it does not affect them

## Cloud sync (optional)

Everything works without an account: tabs live in your browser's local storage (key `guitar_tabs_accessible`).

Signing in (email link or Google) additionally backs tabs up to Firestore under `users/{uid}/tabs/{tabId}` and syncs them between devices. Sync merges instead of overwriting:

- The newer copy of a tab wins (by modification date).
- Tabs that never reached the cloud are pushed up, never discarded.
- A tab that disappears from the cloud after having been synced was deleted on another device, and is removed locally too. Corner case: if you edit a tab offline on one device while deleting it on another, the deletion wins.

The Firebase config in `src/config.js` is a public project identifier, not a secret; access control lives in Firebase Security Rules.

## Development

Requires Node 20 (see `.nvmrc`).

```bash
npm ci          # install
npm run dev     # dev server at http://localhost:3000
npm test        # Vitest unit tests (parser, formatter, merge logic)
npm run build   # production build into dist/
npm run preview # serve the production build locally
```

### Project layout

```
index.html, converter.html, my-tabs.html   the three pages
src/app.js                                 page wiring, shortcuts, save/copy
src/config.js                              Firebase config + feature flags
src/firebase-loader.js                     resolves when the Firebase CDN SDK is ready
src/modules/converter/                     TabConverter, StandardTabParser,
                                           ChordParser, OutputFormatter,
                                           GuitarProImporter (+ tests)
src/modules/storage/                       LocalStorage wrapper, mergeTabs (+ tests)
src/modules/auth/FirebaseAuth.js           sign-in UI and cloud sync
src/modules/ui/                            NotificationManager (announcements,
                                           dialogs), MyTabsPage
src/utils/                                 constants, helpers, validators
```

The parser is a staged pipeline (classify lines → group sections → assign string names → align columns → tokenize → bind techniques → build measures). If a tab parses wrong, add the tab as a fixture in `src/modules/converter/__tests__/fixtures.js` with a failing test — every past parser bug has a test there.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`: install, test, build, deploy `dist/` to GitHub Pages at `/AccessibleGuitarTabConverter/`. Pull requests build and test but do not deploy.

## Accessibility notes

- Announcements go through a single polite `aria-live` region (`NotificationManager`).
- Converting moves focus to the output textarea; re-converting after a settings change deliberately does not move focus.
- The delete confirmation is a real dialog: focus trapped, Escape cancels, focus returns to the invoker.
- The save prompt uses the native `window.prompt` on purpose — it is modal and screen-reader friendly everywhere, which beats a custom dialog for reliability.
