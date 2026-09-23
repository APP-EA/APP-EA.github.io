---
name: crear-web-micro-saas
description: Create money-making micro-SaaS tool websites on Hostinger via three INDEPENDENT capabilities, never force-chained. (a) CONNECT a Hostinger account to Claude Code (install connector, browser login, verify). (b) BUILD a 100% client-side tool web (HTML/CSS/vanilla JS, no build, no backend, no API keys) from a 25-archetype catalog including QR generators, file converters, image compressors, PDF tools, speed tests, IP lookup, calculators, OCR and background removal. (c) PUBLISH the site live to Hostinger. Ask to connect and it only connects; ask for a web and it only builds; ask to publish and it only publishes. Use whenever the user wants a web herramienta, micro-SaaS, converter, generator, calculator or tester web, or a tool site monetized with ads. Triggers include crea una web micro saas, hazme un generador de QR, una web para convertir archivos, un test de velocidad, una calculadora online, and their English equivalents.
---

# Micro-SaaS Studio · v1 — connect · build tool webs · publish, each on demand

This is **one home for several independent capabilities**, in the same spirit as
`conectar-hostinger-v3` but specialized in **tool websites (micro-SaaS)**:
single-purpose utility webs where **the product IS the tool** — a QR generator, a
file converter, an image compressor, a speed test — running **entirely in the
visitor's browser**. No backend. No API keys. No per-use cost. They live happily
on normal shared hosting and typically monetize with ads (AdSense) or a
"pro" placeholder tier.

- 🔌 **Connect** a Hostinger account to Claude (so their hosting can be managed).
- 🧰 **Build** a tool website from the 25-archetype catalog — or any new tool
  idea that fits the client-side rules.
- 🚀 **Publish** a finished site live to Hostinger via the connection.
- (plus 🎯 tool recommendation, ✏️ surgical edits, ✅ verify.)

The person pulls **whichever they need, when they need it**. Read which
capability the current message is asking for and serve **exactly that**.

> **This revision folds in a full end-to-end build (QR3D).** The QR + 3D-print
> archetype in `reference/11` is now the battle-tested version (real 3MF with
> baked-in color, styled relief, live print warnings, lazy WebGL preview), the
> three.js vendoring bug is fixed (`14` + `descargar-librerias.py`), and the
> Windows/tool-web gotchas that actually bit during that build are written down
> (`07` §0, `08` §0). Invariants 11–13 below are the distilled lessons.

---

## THE GOLDEN RULE: do only what was asked, then stop

**Do not chain capabilities.** Do not turn one request into a full pipeline.
Read the message, do that one thing, verify it, and stop.

- User: *"conéctame Hostinger"* → you **only** connect and verify. You do
  **not** start building a tool.
- Later: *"hazme un generador de códigos QR para restaurantes"* → you **only**
  build the site. You do **not** deploy it.
- Later: *"publícala"* → you **only** publish to Hostinger.

Never assume the next room. **Read the state from context** each time — is
Hostinger connected? does a project folder already exist? At the very end you
may offer **one** optional sentence naming a natural next step ("¿la publico en
tu hosting, o la dejamos en local?"), but you **never start it unprompted**.

If a request is genuinely ambiguous, ask **one** short question — not a
multi-question intake.

---

## Route the request → capability

| What they say / the situation | Capability | Primary ref |
|---|---|---|
| "conéctame Hostinger", "vincula mi hosting", "que Claude gestione mi web" | 🔌 **Connect** | `reference/12-hostinger-connect.md` |
| "hazme una web de [herramienta]", "un conversor de…", "un generador de…", "una calculadora de…" | 🧰 **Build** | `02` (catalog) → the matching recipe (`05`/`06`/`11`) + `03` + `01` |
| "¿qué herramienta me recomiendas crear?", "dame ideas de micro-SaaS" | 🎯 **Recommend** | `reference/02-microsaas-catalog.md` |
| A project exists and "cambia… / añade… / otro color / añade otro formato" | ✏️ **Surgical edit** | the existing files + invariants |
| "publícala / súbela / ponla online" | 🚀 **Publish** | `reference/13-hostinger-deploy.md` |
| "¿está lista?", "la subí y no funciona / se ve vieja" | ✅ **Verify / cache** | `08`, `07`, `10` |

Capabilities **can** compose when the user asks for a lot at once ("conéctame y
súbeme un compresor de imágenes" → 🔌 → 🧰 → 🚀). Compose because *they asked
for the whole thing*, never by reflex.

---

## The capabilities

### 🔌 Connect Hostinger
Identical to `conectar-hostinger-v3`: install/upgrade Node (24+), install the
connector, register it with `--scope user`, trigger the browser OAuth login, and
**verify with a real read-only call** before claiming success. Full method +
fallbacks + golden rules in `reference/12-hostinger-connect.md`. Env check:
`scripts/diagnostico.ps1` (Windows) / `scripts/diagnostico.sh` (Mac).
**Independent:** if they only asked to connect, stop after verifying.

### 🧰 Build a tool website (the heart of this skill)
The flow, always in this order:

1. **Match the ask to an archetype** in `reference/02-microsaas-catalog.md`
   (25 archetypes in 7 technical patterns). If the idea is new, map it to the
   closest **pattern** — the catalog is a starting point, not a limit. If the
   idea genuinely cannot run client-side (needs accounts, needs a database,
   needs a paid API), say so honestly and propose the closest thing that can.
2. **Read the recipe** for that pattern — `reference/05-recipes-files-and-media.md`,
   `reference/06-recipes-ai-in-browser.md` or
   `reference/11-recipes-network-and-generators.md`. Recipes carry pinned
   libraries, exact vendored files, working snippets and the gotchas that make
   the tool work first try. **Never improvise a library choice** that a recipe
   already makes — the pins in `reference/14-library-pinning.md` are the law.
3. **Vendor the libraries** the recipe demands with
   `scripts/descargar-librerias.py <archetype>` (downloads pinned versions into
   `lib/`). Never hot-link CDNs at runtime.
4. **Build the page** per `reference/03-tool-page-design.md` (tool above the
   fold, SEO by search intent, honest limits, ad slots as placeholders) and
   `reference/01-stack-and-conventions.md` (file structure, classic scripts,
   IIFE; ESM-only libs go through the dynamic-import bridge — see `14`).
5. Copy `templates/htaccess.template` → `.htaccess`, verify with
   `scripts/verify_project.py`, preview with `python -m http.server`
   (**mandatory** — most tool libs need http, `file://` won't do), and hand it
   over. **Do not deploy unless asked.**

### 🚀 Publish to Hostinger
Put a finished site live using the 🔌 connection: free temp domain (or their own
domain) → create website → zip the site (index.html at root, include
`.htaccess`, exclude working files) → `hosting_deployStaticWebsite` → **verify
the live URL by actually using the tool once**. Async-creation and Windows-path
gotchas in `reference/13-hostinger-deploy.md`. **Requires the connection**; if
it's not connected, say so and offer to connect — but only if they want it.

### 🎯 Recommend / ✏️ Surgical edit / ✅ Verify
As on-demand as the rest: a reasoned pick from the catalog (by niche, search
demand and difficulty), the smallest change to an existing tool in its own
style, or a pre-launch pass (`08` + the checks in `07`). Never the whole funnel
unless asked.

---

## Always-on invariants

**Communication:** the user is **non-technical**. Zero jargon — never say
"WASM", "CDN", "endpoint", "API", "deploy", "npm", "worker". Say "el motor de la
herramienta", "los archivos del diseño", "publicar tu web". Run every command
yourself; the only thing the user ever does by hand is the browser login click.
Announce before anything visible happens, celebrate milestones (✅), never show
a raw error, and **verify before you claim** anything works.

**Micro-SaaS invariants (on top of the web invariants below):**

1. **100% client-side.** Everything runs in the visitor's browser. No backend,
   no serverless, no database, no user accounts. If a feature needs any of
   those, redesign it or drop it.
2. **No API keys, no paid services, ever.** The only external calls allowed are
   the keyless free services whitelisted in the recipes (IP lookup, speed-test
   files). Nothing that can bill the owner or die when a key expires.
3. **Privacy is the pitch.** Files never leave the visitor's device — say it
   proudly in the page copy ("tus archivos no se suben a ningún servidor").
4. **The tool works above the fold.** A visitor must be able to use the tool
   within 3 seconds of landing, without scrolling, reading or clicking through
   anything. Content (SEO text, FAQ, related tools) lives BELOW the tool.
5. **Heavy engines load on demand.** WASM/AI payloads (ffmpeg, OCR, background
   removal) load only when the user first acts, with a visible progress bar —
   never on page load. First paint stays instant.
6. **Honest limits.** Client-side has ceilings (file sizes, formats, model
   quality). State them in the UI ("archivos de hasta ~200 MB") instead of
   letting the tool die silently. Never promise what the recipe says it can't
   do (e.g., perfect PDF→Word).
7. **Graceful degradation.** Feature-detect every engine. If the browser can't
   run it, show a clear message — never a dead button. `safe()` around every
   init, as always.
8. **Monetization slots are placeholders.** Reserve clearly-marked `<div>` ad
   slots (leaderboard under the tool, one in-content) but ship them empty or
   with a subtle placeholder. AdSense code is pasted later by the owner — the
   skill never includes third-party ad scripts by itself.
9. **One tool per page, SEO by intent.** The page targets one search intent
   ("comprimir imagen online") with title/H1/FAQ matching it. Extra tools are
   extra pages, cross-linked in a "más herramientas" section.
10. **Verify by using the tool.** Before claiming done: run the happy path once
    in the preview (convert a real file, generate a real QR, run a real test)
    and check the console for errors.
11. **Verify the real artifact, not a screenshot.** Run the happy path over
    http and, for anything that exports a file, **re-open and parse that file**
    (a produced `.3mf` must contain 2 colored parts; a zip must unzip). The
    in-app browser's screenshots flake — DOM + artifact probes are the gate
    (`07` §0.4, `08` §0).
12. **Generated files: UTF-8, no BOM, no NUL, LF.** A single stray NUL byte
    silently kills a `.js` from that point on and the error points nowhere near
    it — verify the raw bytes after writing (`07` §0.1). This one cost real time.
13. **Heavy engines are lazy, gated and background-safe.** Load on
    visibility (not page load), render only while visible, feature-detect with a
    graceful fallback (never a dead button), and survive a zero-size background
    tab (`innerHeight === 0` guard + `visibilitychange`) — `07` §0.3, `11` C.1.

**Web quality invariants** (shared with `conectar-hostinger-v3`, full detail in
`reference/04-critical-gotchas.md`): classic `<script defer>` + IIFE +
`window.__BRAND__`; `.htaccess` in every root + `?v=YYYYMMDD` on every asset
ref; native scroll; reduced-motion gates only intrusive effects; hardcode
content in HTML (JS only enriches — for tool pages that means the SEO copy, FAQ
and structure render without JS, the tool itself is the JS); IntersectionObserver
threshold ≤ 0.05 + safety timeout; content first, animation second; robustness >
spectacle; verify before claiming.

**The ESM bridge (the one deviation from the shared stack):** some 2026 engines
ship ESM-only. The rule: the page skeleton stays classic scripts; ESM-only
engines are vendored into `lib/` and loaded lazily via **dynamic `import()`
from inside a classic script**, feature-detected and wrapped in `safe()`. Never
`<script type="module">` for the page itself, never relative-import chains you
didn't vendor. Details and per-library verdicts in
`reference/14-library-pinning.md`.

If an invariant and a feature conflict, the invariant wins.

---

## Environment (handle once, silently, when a capability needs it)

- 🔌 **Connect** needs **Node.js 24+** (the Hostinger connector requires it).
  Check with `scripts/diagnostico.*`.
- 🧰 **Build** needs Python 3 (helper scripts + local preview server). The
  preview server is **not optional** for tool webs: WASM engines, workers and
  dynamic import need http. `python -m http.server 8137` from the project root.
- Install what's missing yourself where you can; only ask the user to install
  something if every automatic path failed.

---

## Files index

```
SKILL.md                                ← this file — the multi-capability router
intake-template.md                      ← the few questions worth asking (build)
recommended-settings.json               ← optional zero-prompt pre-authorization
evals/evals.json                        ← capability-routing evals
reference/
  01-stack-and-conventions.md           ← file structure, IIFE, script order (shared)
  02-microsaas-catalog.md               ← the 25 archetypes in 7 technical patterns
  03-tool-page-design.md                ← tool-first layout, SEO, ads placeholders
  04-critical-gotchas.md                ← the web invariants, in full (shared)
  05-recipes-files-and-media.md         ← converters, compressors, PDF, audio, video
  06-recipes-ai-in-browser.md           ← background removal, OCR, scanner, voice
  07-windows-troubleshooting.md         ← reduced-motion + the 3-machine test (shared)
  08-pre-deploy-checklist.md            ← the verify pass (shared)
  09-environment-detection.md           ← Node/Python/curl detection (shared)
  10-deployment-and-cache.md            ← cache-busting + .htaccess strategy (shared)
  11-recipes-network-and-generators.md  ← IP, speed test, QR (+3D 3MF, hardened), calculators…
  12-hostinger-connect.md               ← 🔌 connect the Hostinger account (shared)
  13-hostinger-deploy.md                ← 🚀 publish a static site to Hostinger (shared)
  14-library-pinning.md                 ← pinned versions, vendoring, the ESM bridge
templates/
  htaccess.template                     ← copy as `.htaccess` to every root
scripts/
  diagnostico.ps1 / .sh                 ← 🔌 environment check for the connection
  descargar-librerias.py                ← vendor pinned libs into lib/ per archetype
  verify_project.py                     ← post-generation sanity check
```

---

## Zero-prompt mode

If the user wants the skill to run without approving each command, have them
merge `recommended-settings.json` into their `~/.claude/settings.json` once. It
pre-authorizes only this skill's own scripts, the Hostinger connection commands,
and a few safe helpers. Nothing destructive.

---

## Final note

One studio, several doors. When they say *"conéctame Hostinger"* you hand them a
working connection; when they say *"hazme un compresor de imágenes"* you hand
them a finished tool that works the first time; when they say *"publícala"* you
hand them a live URL — each on its own, each finished, never forced together.
