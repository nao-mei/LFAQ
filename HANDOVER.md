# Handover: how to maintain this site

A small static website: a welcome page, a "what are we doing today" planner, a dinner wheel, a "choose anything" wheel and a countdown. There is no server, no database, no accounts and no tracking. This document explains how to keep it running if someone new takes it over.

## What it is made of

- Astro (static site generator) with TypeScript and Svelte components for the interactive parts.
- Pages are built into plain files and published with GitHub Pages.
- Everything someone types into the site (a chosen name, custom wheel choices, a custom countdown, one-off plan changes) is saved in that person's own browser (`localStorage`) and nowhere else.
- No third-party requests are made when the site runs. Fonts are system fonts, and the "Hear it" button uses voices already installed on the device.

## Running it locally

Requires Node 22 or newer.

```bash
npm install
npm run dev       # live preview at http://localhost:4321/LFAQ/
npm test          # unit tests (dates, wheel maths, plan rules)
npm run check     # type-check
npm run build     # builds the static site into dist/
```

The site is served under the `/LFAQ/` path. That comes from `base` in `astro.config.mjs`; change it there if the repository is ever renamed.

## Where the content lives

Almost everything that changes is plain JSON in `content/`. No code changes are needed for routine updates.

| File | What it controls |
|---|---|
| `week.json` | The usual week: for each day, in School and in Holiday mode, a headline, a pickup time and an after-school activity |
| `changes.json` | Dated holidays (`from`, `to`, `label`), one-off changes for a single date, and important dates |
| `dinner.json` | The dinner wheel. A tree of choices with an optional `weight` (a bigger number gives a bigger slice) and follow-up choices under each |
| `choose.json` | The starting choices on the "choose anything" wheel |
| `facts.json` | The fun facts. One is shown per day, in order, by day of the year |
| `pictures.json` | The pictures for the dot reveal. Files live in `public/pictures/` |

Dates are written `YYYY-MM-DD`. Times are plain text, so write them however they should appear.

### Routine tasks

- **Every term:** update the school holiday dates in `changes.json`. Old entries can be deleted any time; past dates are ignored automatically.
- **When the weekly routine changes:** edit `week.json`.
- **A one-off change (an appointment, a trip):** the "Grown-ups" page (link in the footer) builds a one-off change and can send it to a device as a link, or produce text to paste into `changes.json`. One-off changes and important dates disappear by themselves once the day has passed.
- **More pictures:** add an image to `public/pictures/`, then add a line to `pictures.json` with a short description (it is read out by screen readers). Prefer pictures with a clear subject that fills the frame. Remove location data (EXIF) from photos first. Do not use pictures of identifiable people.
- **More facts:** add `{ "topic": "...", "text": "..." }` lines to `facts.json`. Keep them short and checkable, and note the source somewhere outside the repo.

## How the plan page decides what to show

For the day being shown, in order of priority:

1. A change made on that device with "Change today" (cleared at midnight).
2. A dated one-off change from `changes.json` or from a shared link.
3. The usual week for the current mode (School or Holiday).

Mode is Automatic by default: dates inside a holiday range switch it to Holiday, and anything else is School. A person can force School or Holiday on their own device. The "Coming up" list shows the next seven days using the same rules. The rules are in `src/lib/plan.ts` and covered by tests in `src/lib/lib.test.ts`.

## Publishing

The workflow in `.github/workflows/deploy.yml` builds and publishes the site every time something is pushed to the `main` branch. It runs the tests and the type-check first, so a failing check stops the publish.

To publish for the first time, the repository needs GitHub Pages switched on with **Source: GitHub Actions** (repository Settings, then Pages). After that, pushing to `main` is all that is needed. The Actions tab shows progress and any failure.

To roll back, revert the commit and push.

## Keeping the repository free of identifying information

This repository is public. Keep it that way:

- Use generic wording only: "Swimming", "After School Club", "Pickup 15:15". No school, club, venue, teacher or street names.
- No names of children or family members in content, code, comments, commit messages or picture descriptions. A name a child chooses for the welcome page is saved only in their own browser; that is by design.
- No photos of people. Pictures should be drawings or non-identifying subjects.
- Commit with a GitHub "noreply" email address, not a personal or work address. In GitHub Settings, Emails, keep the email private and block command-line pushes that expose it.
- Keep private notes, drafts and source photos outside the repository.

A quick check before publishing anything new:

```bash
git grep -n -i -E "your-list-of-words|@.*\.(com|co\.uk)|\b[A-Z]{1,2}[0-9]{1,2} ?[0-9][A-Z]{2}\b"
```

Replace the first pattern with whatever must never appear (names, places). Keep that list itself outside the repository.

## Things that are deliberately simple

- **No sound recordings.** The "Hear it" button speaks with voices already on the device, and only when the device has a voice for that language. Where there is none the button is hidden and the written "say it" spelling still shows.
- **Phonetic spellings** in `src/islands/Greeting.svelte` are rough English approximations. Fix any that a native speaker says are wrong.
- **Greeting list** is in the same file. Add a line with the greeting, the language, a "say it" spelling and (optionally) a language code for the voice.
- **Motion.** Everything animated respects the "reduce motion" setting, and the dot picture can be revealed with the "Show me" link instead of swiping.

## Where the main code is

- `src/pages/`: one file per page.
- `src/islands/`: the interactive parts (`Wheel`, `DotPicture`, `DinnerFlow`, `CustomWheel`, `TodayPlanner`, `PlanEditor`, `HowLong`, `Greeting`, `Fact`).
- `src/lib/`: plain logic with tests (`wheel.ts`, `dates.ts`, `plan.ts`, `b64.ts`).
- `src/styles/global.css`: colours and shared styling. The palette is red and blue; check contrast if you change it.

## Known gaps and ideas

- Facts have no recorded sources yet. Check each before relying on them.
- Important dates do not repeat yearly (for example birthdays).
- A one-off change can replace a pickup time or activity but cannot blank it. To show nothing, change the usual week and leave the box empty.
- A "today in history" line was considered and not built.
- Sharing changes to another device uses a link, because there is no server to send them through.
