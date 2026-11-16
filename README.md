# LFAQ

A small site of wheels and plans: a welcome page with a dot picture and a fun fact, a dinner wheel, a wheel for any choices, a daily plan with a week ahead, and a countdown (Christmas by default).

Static site (Astro, TypeScript, Svelte). No backend, no tracking, no third-party requests. Anything a person types in is kept in that browser only.

## Run it

```bash
npm install
npm run dev      # http://localhost:4321/LFAQ/
npm test         # unit tests
npm run build    # static output in dist/
```

## Change the content

Everything lives in `content/`:

| File | What it controls |
|---|---|
| `dinner.json` | The dinner wheel: choices, optional `weight`, and the follow-up choices under each |
| `week.json` | The default plan for each weekday, in School and Holiday mode (headline, pickup time, after-school activity) |
| `changes.json` | Dated holidays and one-off changes, for example `{ "date": "2026-11-17", "activity": "Dentist" }` |
| `facts.json` | The fun facts (one per day, in order) |
| `pictures.json` | Pictures for the dot reveal (files in `public/pictures/`) |

The `/plan/` page (linked from the footer) helps write `changes.json` entries and can send them to a device as a link.

Keep wording generic: this repository is public.
