# Uploading a print issue from PDFs

How the News & Features pages of Issue 6 (October 30, 2026) were turned into
article drafts on the site. Written so the next issue is a repeat rather than a
rediscovery.

The short version: the page PDFs carry a real text layer, so the article text
can be extracted exactly rather than retyped or OCR'd, and the photos can be
pulled out as their original bitmaps. Everything is written straight to
Supabase with the service-role key. Articles land unpublished.

---

## 1. What you need

Only one secret: `SERVICE_ROLE` in `.env` (gitignored).

That key bypasses RLS, so it can insert into `article` and write to the
`images` storage bucket directly through the REST API. You do **not** need to
run the dev server or `/upload`, and you do **not** need `DATABASE_URL`.

Two traps worth knowing:

- `DATABASE_URL` is the Postgres connection string from Supabase
  (Settings, Database, Connection string, URI). It is **not** the project URL.
  It is only needed if you go through `/api/upload`.
- `SERVICE_ROLE` gates more than it looks like. In `lib/queries.ts` the "yolo
  mode" check keys off `SERVICE_ROLE`, and that same flag decides whether
  Prisma is constructed at all. With `DATABASE_URL` alone, `prisma` is
  `undefined` and `uploadArticle()` throws `"no!"`.

Sanity check the key without printing it:

```js
const p = JSON.parse(Buffer.from(SERVICE_ROLE.split(".")[1], "base64").toString());
// expect: p.role === "service_role", p.ref === "yusjougmsdnhcsksadaw"
```

## 2. Conventions to match

Copy the shape of an article already uploaded for the same issue rather than
inventing one. For Issue 6, row #1153 was the template:

| Column | Value |
| --- | --- |
| `published` | `false` (drafts; an editor publishes later) |
| `category` / `subcategory` | both the section slug, e.g. `news-features` |
| `month` / `year` | the issue's cover date, e.g. `10` / `2026` |
| `markdown` | `true` |
| `authors` | text array, e.g. `["Joy Chen"]` |
| `img` | public storage URL under `images/<year>/<month>/` |
| `content-info` | `Photo: <credit>`, then two blank lines, then the caption |
| `featured`, `Index` | `false` |
| `blurb`, `spotifyUrl` | `null` |

Paragraphs in `content` are separated by a blank line. Hard-wrapped lines
inside a paragraph are fine: with `markdown: true`, remark folds them.

**Check for duplicates before inserting.** Other sections of the same issue are
often already uploaded by someone else. Query the issue first and skip titles
that already exist.

## 3. Extracting the text

Use the PDF text layer (`pdfjs`), not OCR, and not the rendered page.

```js
const c = await page.getTextContent();
const items = c.items.filter(i => i.str.trim()).map(i => ({
  x: i.transform[4], y: i.transform[5], w: i.width,
  h: Math.round(Math.abs(i.transform[3])), s: i.str,
  serif: (c.styles[i.fontName]?.fontFamily || "") === "serif",
}));
```

### Body text is the serif face

This is the single most useful discriminator. Headlines, decks, bylines, photo
credits and captions are all set **sans**; body copy is **serif**. Filtering on
`serif && h <= 13` removes all the page furniture at once, with no per-article
y-tuning. Section headlines are sometimes serif too, but they are 14pt+ so the
height check excludes them.

### Rebuild columns with explicit boundaries

Group items into columns, then read each column top to bottom, in left to right
column order. Detect each article's own column left edges from the items inside
its box, because pages stack stories with different grids:

```js
// left edges: x positions shared by many lines (paragraph indents are rarer)
const hist = new Map();
for (const i of inBox) hist.set(Math.round(i.x), (hist.get(Math.round(i.x)) || 0) + 1);
const common = [...hist.entries()].filter(([, n]) => n >= 5).map(([x]) => x).sort((a, b) => a - b);
const edges = [];
for (const x of common) if (!edges.length || x - edges.at(-1) > 25) edges.push(x);
```

Then assign each item to the column whose band it starts in
(`[edge - 6, nextEdge - 6)`). Do **not** split lines on horizontal gap size:
gutters on these pages can be narrower than a word space, and two columns will
silently interleave into one sentence.

### Paragraph breaks come from the indent

Within a column, a line starting more than ~4pt right of the column's left edge
begins a new paragraph.

### Eight pitfalls that cost real time

1. **Column edge vs paragraph indent.** Detecting "column x positions" from
   line starts gives you the *indent* position. Use the minimum x, or you drop
   every non-indented line and every paragraph becomes one line long.
2. **Float y against an integer bound.** A line at `y = 378.96` fails
   `y >= 379`. Pad y comparisons by ~1.5pt or you lose the bottom line of every
   column.
3. **No spaces between items.** Items are positioned words with no space
   characters. Insert a space when `item.x > prev.x + prev.w + 0.6`.
4. **Letter-tracking.** A few passages are set with heavy tracking, so each
   glyph is its own item and the gaps *between letters* are wider than a normal
   word space. No single threshold separates these (a sweep confirmed: raising
   it produces run-together words without fixing any splits). Detect runs of
   single-character items and score their gaps relative to the run, and keep a
   short explicit repair list for what remains.
5. **Pull quotes are serif.** Quote boxes survive the font filter and will land
   at the top of the article. Exclude them by y range. A standalone quote box,
   closing with a dash and the speaker's name on its own line, is layout
   furniture rather than body copy and belongs out of `content`. Confirm the
   article still reads whole without it before dropping it.
6. **Columns of one story start at different heights.** Charts, photos and the
   headline sit above some columns and not others, so column 2 can begin 265pt
   higher than column 0. A single y range for the whole article silently
   decapitates the taller columns. Give each column its own `yTop`/`yBot`, and
   read the join at every column boundary: the clipped version still reads as a
   sentence ("Voting on school spirit.", "from 6.7 equitable access to"), so
   nothing looks wrong until you compare against the page.
7. **Float x against a column bound.** The mirror of pitfall 2. An item at
   `x = 291.9999` passes `x < 292` and lands one column to the left, which
   interleaves two columns line by line. Use the band `[edge - 6, nextEdge - 6)`
   on both ends, never the bare edge.
8. **Compounds broken at the hyphen.** "academically-" at a line end plus
   "focused" at the next line start joins to "academically- focused". When a
   line ends in a letter followed by a hyphen, close it up with no space.

### Stitching jumps

Front-page stories continue inside ("Continued on Page Four"). Extract each
part separately and concatenate, then drop any paragraph matching
`/^Continued on\s+Page\s+\w+$/i`.

## 4. Extracting the photos

**Rip the embedded images; do not crop the rendered page.** Cropping a render
bakes in captions and neighbouring text, and clipping paths make the placement
rectangles overshoot. Pulling the XObjects gives the original bitmaps, often at
full camera resolution (one was 6240x4160).

```js
const ops = await page.getOperatorList();   // this also resolves page.objs
// walk fnArray tracking save/restore/transform to keep the CTM, and record
// args[0] at OPS.paintImageXObject / paintJpegXObject for the placement rect
const obj = await new Promise(res => page.objs.get(name, res));
// obj: { width, height, kind, data }   kind 2 = RGB_24BPP, 3 = RGBA_32BPP
await sharp(Buffer.from(obj.data), { raw: { width, height, channels } })
  .removeAlpha().webp({ quality: 88 }).toFile(out);
```

Use the placement rect only to work out which article a photo belongs to, and
confirm the pairing against the printed caption rather than by position alone.
Pages routinely carry more images than articles: advertisements, the masthead
tower, chart overlays and pull-quote marks all appear as XObjects. On a page
with two photos for one story, the caption tells you which is the lead.

Upload to the `images` bucket at `<year>/<month>/<slug>-<ts>-<rand>.webp` and
store the public URL (`/storage/v1/object/public/images/<key>`) on the row.

## 5. Uploading

Insert with `POST /rest/v1/article` using the service-role key. Always do a dry
run first that prints title, authors and word count per article.

Guard against duplicates:

```js
const existing = await fetch(`${B}?select=title&month=eq.10&year=eq.2026`, { headers });
const have = new Set((await existing.json()).map(a => a.title.trim()));
// skip any article whose title is already present
```

## 6. Verifying

Eyeballing the articles is not enough: a clipped column leaves a sentence that
still scans. Run a **line-level audit** instead. For every body line on the
page, check that the line appears verbatim inside some uploaded article:

```js
// fold the typographic variants so both sides compare on equal terms
const norm = s => s
	.replace(/[‘’]/g, "'")
	.replace(/[“”]/g, '"')
	.replace(/…/g, "...")
	.replace(/\s+/g, " ")
	.toLowerCase()
	.trim();
const corpus = rows.map(r => norm(r.title + " " + r.content)).join(" @@@ ");
// a print line that is not a substring of the corpus is missing or changed
```

Build the lines **per column**, not across the page, or every line comes out as
two columns spliced together and nothing matches. Expect a short, explainable
remainder: the letter-tracked passages, which sit repaired in the database, and
any pull-quote boxes you excluded on purpose. Anything else is a real gap.

Then confirm:

- Every article reads correctly at its **start and end**. Boundary errors show
  up there first: a byline at the top, or a sentence truncated at the bottom.
- `published` is `false` on every new row.
- No two articles share a byline. A duplicated byline block is a layout slip
  the page itself cannot expose.
- Each `img` URL returns 200 with `image/webp`, and is the size you expect. A
  9KB front-page lead photo means a downsampled copy slipped through.

## 7. Revised pages

Editors send corrected pages after the first upload, under names like
`Pg 1-new2.pdf`, `PAGE 4-ar.pdf` or the same filename re-saved. Do not assume a
new file means new content, and do not assume an unchanged name means unchanged
content. Diff, do not guess:

- **Text:** dump each version's text layer and `diff` them. In Issue 6 this
  separated one real rewrite (page 1) from a one-word typo fix (page 4, `DII`
  to `DLI`) and from a page re-saved with no change at all (page 5).
- **Photos:** rip the images from both versions and compare a hash of the raw
  bitmap, plus the dimensions. Page 3 came back byte-identical; page 1 replaced
  a 466x118 placeholder with the real 4380x1113 photo.

Then re-run the section 6 audit against the final version of every page, not
just the ones that changed. That is what surfaced the clipped columns described
in pitfall 6, which had been in the database since the first upload.

## 8. Issue 6 notes

Transcribe verbatim and report defects rather than guessing at missing words.
Both print defects in the DLI story (#1156) were fixed by the editors in
`Pg 1-new2.pdf`: the Clemens quote that printed as "Working in the elementary
[school], **noof** the world to Peru [and] Ecuador", and the front-page caption
that stopped at "listen to public comments during the". The same revision
replaced the downsampled front-page photo with the full-resolution original and
retitled the story "Major changes to DLI?".

One byline is wrong in print. Page 5 carries a verbatim copy of page 2's byline
block, so "PHS Features: First-Generation Students" (#1164) is credited to Anya
Kshirsagar, Evan Bronzan and Miranda Zhu, who wrote the Dinan story on page 2.
The real authors are Uma Kleven and Daniel Gu, and the database says so. Worth
a correction in the next issue. Take the lesson generally: a byline that is
identical to another story's is the one error the page itself cannot reveal, so
check for repeats across the issue rather than only against each page.

Five passages were de-spaced, with every letter already present and the reading
unambiguous (no words invented): `issued f rom`,
`" T h e 2 0 g e n e r a t o r s ,`, `explanator y`,
`Working t hroug h t his [exchange prog ram]`, and `Princeton Public Librar y`.

Two student quote boxes on page 5, beside "PHS Features: First-Generation
Students" (#1164), are deliberately not in `content`: they are standalone pull
quotes, and the article reads complete without them. Add them if an editor
asks.
