# PANG — Voice

> The character that speaks on every surface of PANG, and the full
> string reference for the app. Absorbs the old `PANG_UX_Copy.md`.
>
> This document is paired with `src/lib/copy.ts` (live string
> constants) and `src/ai/prompts/voice.ts` (the system-prompt seed
> for Claude-generated prose, exported as
> `PANG_VOICE_SYSTEM_PROMPT`).
>
> If the Museumsschild test is the hard rule, this document is the
> inner logic that makes a string pass it. Every string in PANG —
> hand-authored or generated — traces back here.
>
> Last updated: 2026-04-22 — added null-attribution prose corpus
> (few-shot for the P-LLM when one or more of artist/title/medium/
> year is unknown) and split Errors into Actionable (Factual) +
> Opaque (arrival register), per iteration #1 findings. The
> null-attribution register quietly implies the verification line
> without ever naming it.

---

## Who the voice belongs to

The voice is not a person. It is not a mascot, not a brand persona,
not a virtual assistant, not a narrator.

The voice is the **room the collection lives in.**

A gallery room does not introduce itself. It does not apologize for
itself. It does not narrate what the visitor is seeing. The room sets
the conditions — light, distance, quiet — and steps back. When it
speaks at all, it speaks through labels: small signs on the wall that
locate a work in time and place, and nothing more. The voice of PANG
is the voice of those labels, and the voice of the instruction on the
door that says *silence, please* without ever writing *please*.

That metaphor is operative. Every string in PANG can be checked by
asking:

- Would a room say this?
- Would a wall label say this?
- Would the sign by the entrance say this?

If the answer is "no, but a chatbot would," rewrite it. If the answer
is "no, but a marketing email would," delete it.

---

## The four registers

The voice is one character, not one sentence. A character has moods.
In PANG, the moods are registers. Every string lives in one of them.
Strings that drift between registers read as two voices glued
together.

### 1. Quiet (labels, chrome, navigation)

The default register. Factual. Short. Un-interpretive. Locates a
thing without asking the collector to do anything with the location.

- `PROVENANCE` — one word. Uppercase because the typography is the
  label.
- `Offline` — one word.
- `Back` — one word.
- `1 Work` / `17 Works` — digit + noun.

**Test:** could this sit on a museum wall, in the same typeface as
the artist's name, and not look out of place?

### 2. Warm (ownership, arrival)

The one register where the voice gets close to the collector. The
rule: warmth is earned. It appears in exactly two places — the
ownership line and the arrival ceremony — because those are the two
moments where the collector's relationship to a work is the subject.

- `In your collection since February 2025` — warm.
- `Add to wall` — warm imperative.
- `Your collection at true scale` — accessibility label for the Room.

**Test:** does this register only exist because the collector's
relationship to the work is the actual content of the string? If
yes, warm. If the warmth is decorative, demote to quiet.

### 3. Confident (recognition, generated prose)

The register where PANG reports what it understood. **Declarative past
participle** — the action already happened; the app reports the
outcome.

- `Certificate of Authenticity recognized`
- `Filed`
- `Identifying`
- Claude-generated artist bio in the scanner review screen —
  confident, Muji-register, describes without evaluating. Never
  *celebrated*, never *acclaimed*, never *one of the most important*.

**Test:** is the subject a fact the system determined, not an
opinion it formed?

### 4. Factual (errors, system state)

Not apologetic. Not hedging. Not catastrophizing. States what
happened in one sentence, says what to do next in a second if and
only if a next step exists.

- `Connection lost. Try again.`
- `Camera access not allowed. Enable in Settings.`
- `Document not recognized. Try again.`
- `No connection. Saved locally, will upload later.`

**Test:** if Laura reads this and the app is silent for five seconds
afterward, is that okay? If yes, factual is the right register. If
the silence requires apology, the register is wrong *or* the error is
covering for a design failure.

---

## What the voice refuses

Not style preferences. Boundaries of the character. A voice that
crosses them is a different voice.

### First-person anything

No *I*. No *we*. No *our*. No *us*. PANG is an environment, not a
team.

- ❌ `Upload and we sort them`
- ✅ `Upload — sorted automatically`
- ❌ `We found 3 matches`
- ✅ `3 matches`

**Exception:** *you / your* in the ownership moment. *In your
collection since February 2025.* That is the one relationship the
voice acknowledges, once.

### Exclamation marks

Anywhere. Ever. A gallery wall does not raise its voice. Not *Welcome
to PANG!* — *Welcome to PANG.* (Better: no greeting at all. The
collection itself is the welcome.)

### Apology

No *sorry*. No *unfortunately*. No *oops*. Apology undermines
confidence.

- ❌ `Sorry, we couldn't upload that file.`
- ✅ `Upload failed. Try again.`

### Hedging

No *may*. No *might*. No *probably*. No epistemic *should*. The
voice either knows or doesn't know; if it doesn't know, it says what
it does know.

### Marketing phrasing

No *seamless*. No *powerful*. No *beautifully designed*. No
*intelligent*. No *intuitive*. No *delightful*. No *premium* inside a
string. These describe what the app thinks of itself. The character
never describes itself.

### Celebration

No *Great!* No *Awesome!* No *Perfect!* No *Successfully…* preamble.
Success is the default. A one-word confirmation — *Filed* — is the
entire celebration the voice will perform.

### Questions

No *Would you like to…?* No *Do you want to…?* No *Are you sure?*
unless the destructive action is genuinely destructive. Questions are
UI failure. If the interface has done its job, the next action is
obvious.

### Evaluative language in generated prose

When Claude generates artist bios, provenance summaries, or the
monthly reading, the voice refuses evaluative vocabulary. Banned in
generated prose:

- *renowned, celebrated, acclaimed, critically-acclaimed*
- *one of the most important, legendary, iconic, seminal*
- *groundbreaking, pioneering*
- *influential* as a standalone evaluation (fine in *influenced by
  Beuys*)
- *often regarded as, widely considered*
- *known as a master of*

Evaluation belongs to the collector, to the art world, to time. Not
to the room.

---

## What the voice says

### Silence as information

If a work has no provenance data, the provenance section does not
render. No *"No provenance available yet"* placeholder. No *"We're
still gathering this information"* apology. The absence is the
information.

If the scanner has no match, the review screen shows empty fields
ready for Laura to fill. It does not say *"Couldn't find a match —
try editing below."*

### Prefer nouns to sentences

- `Recognizing…` not `PANG is recognizing the document…`
- `3 of 5` not `3 of 5 documents on file`
- `Offline` not `You are currently offline`
- `In your collection since February 2025` — phrase, no period.

### Past participle for completed actions

- `Filed` not `Your document has been filed`
- `Recognized` not `We have recognized your document`
- `Saved` not `Saving your changes`
- `Added` not `Adding to your collection`

Exception: the brief in-progress beat. *Filing…* is allowed between
tap and confirmation; the ellipsis is the contract. As soon as the
action completes, past participle takes over.

### Verb-first for CTAs

- `UPLOAD` not `TAP TO UPLOAD`
- `ADD TO WALL` not `TAP HERE TO ADD TO WALL`
- `SIGN IN` not `PLEASE SIGN IN`
- `Try again` not `Please try again`

### Capitalization as register

- **ALL CAPS** (letter-spaced) = labels and primary CTAs. `PROVENANCE`,
  `UPLOAD`, `ADD YOUR FIRST WORK`.
- **Sentence case** = body copy and secondary instructions. *Hold
  document in frame.*
- **Title Case** = nothing. Ever. Reads as marketing.
- **lowercase** = nothing. The character is quiet but not informal.

---

## Generated prose (the Muji register)

When Claude generates user-facing prose — artist bios in the scanner
review screen today; the monthly reading paragraph tomorrow — the
register is **Muji**.

The Muji-register test:

1. Is the subject a fact, not an evaluation?
2. Is the adjective count zero or one (load-bearing)?
3. Does the sentence locate the subject in place or time, rather
   than in a hierarchy of importance?
4. Could this appear on the small tag inside a Muji product,
   describing the product?

Four yeses: good. Three: acceptable. Fewer: rewrite.

### Artist bio at the ceiling

> *Japanese painter and sculptor based in Nasushiobara. His figures
> — typically children or small animals with large heads — combine
> innocence and unease.*

Subject of both sentences: fact. Adjectives load-bearing.

### Artist bio at the floor (rewrite this)

> *Yoshitomo Nara is one of Japan's most celebrated contemporary
> artists, renowned for his iconic paintings of wide-eyed children.
> His work has been widely acclaimed for its ability to combine
> innocence with a subversive edge.*

Banned: *celebrated, renowned, iconic, widely acclaimed, one of,
subversive edge*. This is what `PANG_VOICE_SYSTEM_PROMPT` exists to
prevent.

---

## The character at three surfaces (worked examples)

### Arrival button

**Context:** a work has just been scanned and added. The arrival
ceremony shows the work spotlit on a black field. A button appears
below the metadata.

**Reading:** Laura is *placing* the work, not submitting a form.
Imperative, but warm — the ownership relationship is the content.

**Landing:** *Add to wall.* (Sentence case, one verb, no period.)

**Refused:**
- *CONFIRM AND ADD* (admin chrome in a moment that should be warm)
- *Add this beautiful work to your collection!* (marketing, bang,
  redundant *your*)
- *Place in collection* (clinical — the work is going on a *wall*,
  not into storage)

### Offline banner

**Context:** the browser reports offline. A narrow banner slides
down.

**Reading:** Laura knows what offline means. The banner confirms the
system knows too.

**Landing:** *Offline.* (One word.)

**Refused:**
- *You are currently offline* (filler)
- *We've lost connection* (first-person plural)
- *Oops — it looks like you're offline* (apology, hedging,
  anthropomorphizing)

### Claude-generated artist bio

**Context:** Laura has just scanned a work; Claude Vision identified
the artist. The bio appears under an `ABOUT THE ARTIST` label.

**Reading:** Muji register. Locate in place and time. Avoid
evaluation. Laura is deciding whether to trust the identification —
evaluative language reads as selling.

**Landing:** *Danish painter based in Copenhagen. His figurative work
draws on Nordic folk iconography and recent painting from Leipzig.*

**Refused:**
- *Laust Hojgaard is one of the most exciting young painters working
  in Denmark today.*
- *Laust Hojgaard is a celebrated Danish artist known for his bold
  figurative paintings.*
- *A Danish painter, Hojgaard's vivid and arresting work has been
  featured in numerous exhibitions across Europe.*

---

## The character's relationship to the collector

The voice does not treat Laura as a user, a customer, a visitor, or a
friend. The voice treats her as the **owner of the room**.

This shapes four things:

- **The voice does not sell.** The transaction has happened. The
  work is on the wall.
- **The voice does not teach.** Laura already knows her collection.
- **The voice does not flatter.** Flattery implies standing to
  judge. The voice has none.
- **The voice does not hedge.** The owner expects confidence from the
  environment.

The one place the voice breaks the room metaphor is the ownership
moment. *In your collection since February 2025* acknowledges, just
once, that the room has an owner. The room does not repeat the
owner's name every time she walks in.

---

## String reference (absorbed from `PANG_UX_Copy.md`)

Every string lives in `src/lib/copy.ts`. When this doc and the code
disagree, the code wins — but the code should be updated to match
this doc's rules immediately. What follows is the canonical list,
organized by surface. **Missing strings are not omissions; they are
silence as information** (see above).

### Global chrome

| Context | String | Register |
|---------|--------|----------|
| Back button | `Back` | Quiet |
| Close button | `Close` | Quiet |
| Cancel button | `Cancel` | Quiet |
| Retry | `Try again` | Factual |
| Offline banner | `Offline` | Factual |
| Reconnecting | `Reconnecting` | Factual |
| Saving locally | `Saved locally. Will upload when online.` | Factual |
| Install prompt CTA | `Add to home screen` | Quiet |
| Install prompt body | `PANG lives on your home screen.` | Quiet |

### The Room

| Context | String | Register |
|---------|--------|----------|
| A11y label | `Your collection at true scale` | Warm |
| Loading | (no string; a tonal breath) | — |
| Empty state | `Add your first work` | Quiet |
| Empty state sub | (nothing) | — |

### Scan / Intake

| Context | String | Register |
|---------|--------|----------|
| Camera permission | `Camera access not allowed. Enable in Settings.` | Factual |
| Framing hint | `Hold the work in frame` | Quiet |
| Stability countdown | (no string; the brackets and timer are the signal) | — |
| Shutter sweep | (no string) | — |
| Identifying state | `Identifying` | Confident |
| Field stagger — artist | `ARTIST` | Quiet |
| Field stagger — title | `TITLE` | Quiet |
| Field stagger — year | `YEAR` | Quiet |
| Field stagger — medium | `MEDIUM` | Quiet |
| Field stagger — dimensions | `DIMENSIONS` | Quiet |
| Artist section label | `ABOUT THE ARTIST` | Quiet |
| Ownership line | `You already own {n} work{s} by this artist.` | Warm (templated) |
| Confirm | `Add to wall` | Warm |
| Retake | `Retake` | Quiet |
| Pick from library | `Choose from library` | Quiet |
| No match fallback | (no string; empty fields present) | — |

### Arrival ceremony

| Context | String | Register |
|---------|--------|----------|
| Opening beat | (work appears; no string) | — |
| Specific line (templated) | *"Your first Japanese artist."* / *"Your fourth Hojgaard, the largest."* | Warm (generated) |
| Document arrival caption | `Certificate of Authenticity` / `Invoice` / `Condition Report` | Quiet |
| Closing CTA | `Add to wall` | Warm |

### Null-attribution prose (few-shot corpus for the P-LLM)

> Emerging-artist works are the **default case**, not the edge case.
> Claude will frequently read a frame and know less than everything.
> These lines are the register for when one or more of
> `{artist, title, medium, year}` is unknown. The P-LLM receives
> them as few-shot exemplars in `PANG_VOICE_SYSTEM_PROMPT`; at
> generation time it picks the pattern that matches the shape of
> the null set and writes a fresh line in the same register.
>
> **The rule:** every null-attribution line must quietly imply that
> the verification line exists, without ever naming it. Phrases like
> *"not yet part of the record,"* *"the gallery may know,"*
> *"waiting to be named,"* carry the implication; phrases like
> *"unknown,"* *"unidentified,"* or any apology break it.

| Null set | Example |
|----------|---------|
| `{artist}` — artist unknown, rest known | *"A landscape in oil, 2023 — the painter's name is not yet part of the record."* |
| `{artist, title}` — two unknown, medium + year known | *"A work on canvas from 2024, signed in the lower corner in a hand not yet recognised."* |
| `{artist, title, year}` — three unknown, medium known | *"A graphite drawing, signature illegible, date uncertain."* |
| `{artist, year}` — artist + year unknown | *"A photograph titled 'Interior, V' — the photographer's name is somewhere the gallery may know."* |
| `{title}` — only title unknown | *"A Kusama sculpture in polished steel, 2019."* (no line needed about the untitled state; title absence is not worth naming) |
| `{title, year}` — title and year unknown | *"A Richter in oil on aluminium, untitled in the record."* |
| `{medium, year}` — medium + year unknown | *"A Hojgaard, title and hand present, the rest to be filled in later."* |
| `{all four}` — everything unknown | *"An object, quietly waiting to be named."* |
| partial signature visible | *"The signature reads 'M. S.' — the full name is somewhere the gallery may know."* |
| clearly a certificate / provenance doc, not a work | *"A certificate, paired with a work already in the collection."* |
| frame is blank or uninformative | *"A blank sheet of paper, held to the light — no image, no inscription, nothing yet to read."* |
| frame contains a photograph of a photograph | *"An image of an image, its origin uncertain."* |

These are exemplars, not canonical strings. The P-LLM does not
echo them — it learns the register from them and writes one fresh
sentence per arrival. `PANG_VOICE_SYSTEM_PROMPT` instructs the
model to vary syntax and never repeat the same pattern twice in a
row within a session.

**What every null line avoids:**

- The word *unknown* as a label (*"Unknown artist"*).
- The word *unidentified*.
- Any sentence that begins *"I could not"* or *"We were unable to."*
- Any direction to the collector to fill anything in.
- Any reference to "the AI," "the scanner," "the system,"
  "recognition," "identification."
- Any apology or hedge.

### Artwork detail

| Context | String | Register |
|---------|--------|----------|
| Ownership line | `In your collection since {month} {year}` | Warm |
| Provenance header | `PROVENANCE` | Quiet |
| Provenance item | `{context}, {year}` | Quiet |
| Documents header | `DOCUMENTS` | Quiet |
| Empty doc slot | (no string; the slot is the signal) | — |
| Filled doc slot label | `Certificate of Authenticity` / `Invoice` / `Condition Report` / `Edition Certificate` / `Insurance` | Quiet |
| Zoom hint | `Pinch to see the paint` | Quiet |

### Verification

| Context | String | Register |
|---------|--------|----------|
| Verification line — verified | (no label; the work is alive) | — |
| Verification line — unverified | `Ask your gallery to confirm` | Quiet |
| Pre-written email subject | `Verification request — {artist}, {title}` | Factual |
| Pre-written email body | *(generated by Correspondence Agent)* | Confident |
| After-send confirmation | `Sent` | Confident |
| Verified confirmation | `Verified by {gallery}` | Confident |

### Document capture

| Context | String | Register |
|---------|--------|----------|
| Capture prompt | `Hold document in frame` | Quiet |
| Recognizing | `Recognizing` | Confident |
| Recognized — CoA | `Certificate of Authenticity recognized` | Confident |
| Recognized — invoice | `Invoice recognized` | Confident |
| Recognized — condition report | `Condition report recognized` | Confident |
| Filed | `Filed` | Confident |
| Unrecognized | `Document not recognized. Try again.` | Factual |

### Auth

| Context | String | Register |
|---------|--------|----------|
| Invite landing | `{Gallery name} invited you to PANG.` | Quiet |
| Invite CTA | `Open your collection` | Warm |
| Passkey prompt | `Sign in with your device` | Quiet |
| Passkey success | (no string; the collection opens) | — |
| Fallback OTP | `Check your email to continue.` | Quiet |
| OTP expired | `Link expired. Open the original email.` | Factual |

### Preferences (the nine knobs)

> PANG ships one opinionated base design with nine bounded knobs.
> The settings surface reads like wall labels, not a settings panel.
> See `PANG_Architecture_2026.md` § 1.5 for the knob definitions.

| Context | String | Register |
|---------|--------|----------|
| Section header | `Preferences` | Quiet |
| Knob — Time source | `TIME` / options `Real`, `Morning`, `Day`, `Evening`, `Night` | Quiet |
| Knob — Warmth | `WARMTH` / `Subtle`, `Balanced`, `Pronounced` | Quiet |
| Knob — Wall density | `WALL` / `Spacious`, `Balanced`, `Dense` | Quiet |
| Knob — Room scale | `ROOM` / `Intimate`, `Standard`, `Grand` | Quiet |
| Knob — Motion | `MOTION` / `Full`, `Reduced`, `Off` | Quiet |
| Knob — Audio | `AUDIO` / `Off`, `On` | Quiet |
| Knob — Haptics | `HAPTICS` / `Off`, `On` | Quiet |
| Knob — Display name | `DISPLAYED AS` / (free text, 1–40 chars) | Quiet |
| Knob — Light/dark | `APPEARANCE` / `Auto`, `Light`, `Dark` | Quiet |
| Reset affordance | `Reset to defaults` | Quiet |
| Persist confirmation | (no string; the change is the signal) | — |

No freeform theme builder. No color picker. No font menu. A missing
string is silence as information.

### Errors

> PANG splits errors into two tiers. The tier depends on what the
> collector can do next.
>
> - **Actionable** — the collector can fix it directly (grant a
>   permission, reconnect, free up space). These stay in the
>   **Factual** register: plain, short, instructive.
> - **Opaque** — something failed between the capture and the
>   record, and the collector cannot act on it meaningfully.
>   These move into the **arrival register** — voice-authored
>   prose in the same character as the arrival line. A failure
>   is a *moment*, not a dialog box. The same rule that makes
>   arrival feel like a gallery applies here: we describe what
>   happened and step back.
>
> Hand-authored only. Claude does **not** generate the opaque
> lines at failure time — the P-LLM is usually what failed. The
> corpus below ships as a static rotation in `src/lib/copy.ts`;
> the surface picks one appropriate to the failure mode.

**Actionable errors** (Factual register — stay as wall-label terse):

| Context | String | Register |
|---------|--------|----------|
| Camera permission | `Camera access not allowed. Enable in Settings.` | Factual |
| Network (dropped mid-write) | `Connection lost. Try again.` | Factual |
| Quota | `Out of space. Free up room and try again.` | Factual |
| Other system permission | `{Feature} not allowed. Enable in Settings.` | Factual |

**Opaque failures** (arrival register — voice-authored, rotated):

| Failure mode | Line |
|--------------|------|
| Capture unreadable | *"The frame returned nothing readable. The light, perhaps, or the angle."* |
| Capture unreadable (alt.) | *"Nothing came back from the frame. Another angle may help."* |
| Upload mid-stream loss | *"The record did not arrive. The work waits."* |
| Signal lost between steps | *"A signal was lost between the camera and the page."* |
| Agent timeout | *"The reading did not complete. A moment, and another pass."* |
| Agent refusal / safety block | *"The reading stopped short. The work remains, the record is thin."* |
| Document pairing failed | *"A document was seen, but not yet matched to a work."* |
| Offline capture queued | *"Held, for now. The record will arrive when the network does."* |
| Retry affordance (button) | `again` |
| Retry affordance (verbose, on long delay) | `another look` |

**What the opaque lines avoid** (same rules as null-attribution):

- No *"Error,"* *"Failed,"* *"Couldn't,"* *"Something went wrong."*
- No *"Try again"* as a full sentence (use it only as the short
  CTA on actionable errors).
- No reference to *the AI,* *the scanner,* *the API,* *the server,*
  *the request,* *the model.*
- No exclamation marks.
- No reassurance (*"Don't worry,"* *"This happens sometimes"*) —
  reassurance is a chatbot register.

**How the surface composes a failure moment:**

1. One opaque line, centered, in AI-ink (same treatment as the
   arrival line).
2. One retry affordance below, in Quiet register (`again`).
3. No toast. No banner. No error code. No dev overlay. No stack.
4. If the error is *actionable*, the Factual line takes over
   instead — because there's a concrete next step the collector
   can take, and voice-register prose would obscure it.

This is the rule that fixes the regression where
`"could not read the work"` passed the Museumsschild test by
the letter, not the spirit.

### Monthly reading (Narrative Agent)

| Context | String | Register |
|---------|--------|----------|
| Section header | `This month` | Warm |
| Paragraph | *(generated, Muji register, one paragraph, observational, never evaluative)* | Confident |
| Dismiss | (tap anywhere; no string) | — |

---

## How to write a new string

1. **Pick the register.** If the string sits between registers, the
   feature is probably mis-specced.
2. **Write the longest version first.** Get the meaning on paper.
3. **Strip until only meaning remains.** Remove *you are, currently,
   please,* adjectives that don't carry weight, hedges, apologies.
4. **Apply the Museumsschild test.** Would this sit on a museum wall?
5. **Read it next to three existing strings.** If the new string
   sounds like a different voice than *Filed, Offline, Add to wall,*
   revise until it belongs.

---

## Failure prose

When something between the collector and the record goes wrong, the
voice does not apologise. It observes what is literally the case and
stops. The retry affordance is the button; the prose is the
observation.

Added 2026-04-22, iteration #1 findings §5. The P-LLM cannot author
its own excuse — these lines are hand-curated and live in
`src/ai/prompts/failure.ts` as a keyed corpus, pulled at runtime by
the Viewfinder, the `/scan` failed state, and any 5xx surfaced from
`/api/intake`.

**Rules for authoring a failure line:**

- Describe what is literally the case. Not "we couldn't …"; not
  "please try again." Observe, not apologise.
- Sentence case. No emoji. No vocabulary from the banned list
  (Chapter 04 · § *What the voice refuses*).
- At most one subordinate clause. A failure line is not a paragraph.
- No imperative. Retry is the button next to the line, not the line.
- No first-person plural ("we were unable to …"). The voice doesn't
  speak for itself.
- Name the frame, the light, the page, the camera, the record — the
  objects — not "the system," "the app," "the server."

**Camera acquisition:**

| Key | Prose | Trigger |
|---|---|---|
| `camera/denied` | "The camera is held by the browser, not yet released to the page." | `NotAllowedError`, `PermissionDeniedError` |
| `camera/contested` | "The frame returned nothing readable. The light, perhaps, or the angle." | `NotReadableError`, `TrackStartError` |
| `camera/unreadable` | "The camera opened, then closed its eye." | `AbortError`, unclassified camera failure |
| `camera/unsupported` | "This device has not offered a camera the page can use." | `OverconstrainedError`, `NotFoundError` |

**Capture + rectify:**

| Key | Prose | Trigger |
|---|---|---|
| `capture/no-frame` | "The shutter fired on an empty frame." | `grabFrame()` resolves with no pixels |
| `capture/rejected` | "The image did not carry enough of the work to hold on to." | Rectification produced a degenerate quadrilateral |

**Upload + transport:**

| Key | Prose | Trigger |
|---|---|---|
| `upload/offline` | "A signal was lost between the camera and the page. The work waits." | `status === 0` (network) |
| `upload/timeout` | "The record did not arrive. The work waits." | `408`, `504` |
| `upload/rejected` | "The page accepted the image, then set it aside." | `400`–`499` (except `422`) |

**Agent pipeline:**

| Key | Prose | Trigger |
|---|---|---|
| `agent/unreachable` | "The reading room is quiet. The record will be held until it answers." | `5xx` from `/api/intake` |
| `agent/refused` | "The reading room returned the image without a note." | `422` (agent declined) |
| `agent/empty` | "The reading room returned a blank page." | `200` with empty output payload |

**Catch-all:**

| Key | Prose | Trigger |
|---|---|---|
| `unknown` | "Something passed between the camera and the record, and did not come back." | No other branch matched |

A line that doesn't fit any existing key is added to this table first,
then mirrored into `src/ai/prompts/failure.ts`. The runtime defaults
to `unknown` for missing keys, so a deploy is never silently broken
by a code path ahead of doctrine.

---

## How to write a prompt that generates strings in this voice

When wiring a new Claude call that produces user-facing prose, import
`PANG_VOICE_SYSTEM_PROMPT` from `src/ai/prompts/voice.ts` and
prepend it to the system message. The seed does three things:

1. Establishes the character (observational, environmental, not
   conversational).
2. Names the register (Muji, for generated prose).
3. Lists banned vocabulary and provides positive + negative exemplars.

Do **not** re-specify the voice inline. If a route needs additional
context (e.g. *"this is a one-paragraph monthly reading, not a
scanner bio"*), add that as supplementary instructions *after* the
seed, not as a replacement.

---

## Related documents

- `CLAUDE.md` § *The Museumsschild test* — the principle statement.
- `src/lib/copy.ts` — the live string constants.
- `src/ai/prompts/voice.ts` — the Claude system-prompt seed.
- `PANG_AI_Era_2026.md` § *Voice discipline* — how each agent
  prepends the seed and validates output against the banned list.
