# Anti-UI-Slop Skill

A strict frontend and UI/UX standard for AI coding agents and developers. Bans generic modern AI/SaaS design clichés ("UI Slop"). Mandates **KISS (Keep It Simple, Stupid)**, zero buzzwords, and clean, high-craft digital interfaces that respect user intelligence without dumbing down.

## The Problem: Modern UI Slop

AI models and boilerplates frequently generate identical, low-effort landing pages and interfaces:
- Buzzword soup and hollow hype ("Supercharge your workflow", "Unleash the next-gen AI paradigm", "Seamlessly manage")
- Reinventing basic primitives or authoring ad-hoc duplicate markup instead of searching and reusing existing components
- Pretentious faux-editorial serif dressing (*Playfair Display, Instrument Serif*) on low-effort, generic copy
- Heading stacking bloat (Eyebrow tag -> Giant H2 -> Subtitle paragraph -> Card H3)
- Over-explaining detail (slop markup routinely over-explains obvious details with patronizing helper text, redundant subtitles, and descriptive bloat instead of letting self-explanatory data speak for itself)
- Random floating 3D / Three.js primitives (spinning toruses, chrome blobs, shader canvases) floating aimlessly in backgrounds
- Neon purple glow on pitch black backgrounds
- Useless floating capsule pills (`STATUS: ONLINE`, `Ready to ship`, fake pulsing dots)
- Icon soup (icons placed beside every single heading, label, and button)
- Unanchored vanity metrics ("10x Faster", "99.9% Better")
- Fake upward spline curves pretending to be charts
- Low-density "desert" layouts with massive empty padding
- 3 identical feature cards with emojis and vague marketing slogans
- Fake macOS terminal hero graphics with red/yellow/green dots
- Decorative sparkle icons next to every button
- Bento grids with placeholder miniature widgets
- Blinding uncalibrated `#FFFFFF` canvases, discolored "piss white" (`#FAF9F5`), or dreary cold "blueish gray" washes

This skill forces AI agents (Google Antigravity, Claude Code, Cursor, Windsurf, Copilot) and human engineers to embrace KISS and build clean, functional, durable, and unpretentious software interfaces.

## The 39 Prohibitions & Prescribed Alternatives

| # | Prohibited Cliché ("Slop") | Why It Is Banned | Mandatory Alternative |
|---|---|---|---|
| 1 | **Harsh Gradients** | Multi-stop high-contrast linear/radial gradients create visual noise and cheapen the UI. | Use solid, calibrated background tones or flat intentional surfaces. If depth is required, use single-hue opacity shifts. |
| 2 | **Pure White (`#FFFFFF`), "Piss White" & Murky Blueish Gray** | Stark `#ffffff` causes glare, while yellowed "piss white" cream (`#FAF9F5`) and dreary cold "blueish gray" washes look dirty, muddy, and cheap. | Use pleasing, clean, balanced neutrals: crisp modern off-whites (`#F9F9FB`, `#F4F4F6`, `#F8F9FA`, `#F5F5F7`, `#FAFAFA`) or refined charcoals (`#121316`, `#18181B`). Recommend genuinely pleasing, eye-friendly tones that avoid yellow/parchment discoloration and muddy blueish grays. |
| 3 | **Rainbow Coloring** | Throwing 5+ bright accent colors across badges, cards, and buttons creates visual chaos. | Restrict to a disciplined palette: 1 primary brand color, 1 neutral scale, and strict semantic colors (success/error) only where functional. |
| 4 | **Drop Shadows** | Muddy, fuzzy `box-shadow` spreads (`0 20px 40px rgba(...)`) look sloppy and dated. | Use crisp 1px borders, subtle tone-on-tone elevation changes, or flat geometric boundaries. |
| 5 | **3 Feature Cards in a Row** | The ubiquitous 3-column "Icon + Title + 2 sentences" layout is lazy and content-free. | Use asymmetric layouts, split-screen interactive deep-dives, tabular specs, or contextual workflow walkthroughs. |
| 6 | **Emojis in UI and Copy** | Emojis degrade professional typography and feel like cheap templates. | Use precise typography and clean vector SVG icons only when strictly necessary for clarity. |
| 7 | **Liquid Glass / Glassmorphism** | `backdrop-filter: blur()` and milky translucent borders hurt readability and performance. | Use solid, opaque surfaces with high contrast and legible content. |
| 8 | **Vague Marketing Fillers** | Low-information placeholder copy and decorative fluff waste screen space. | Provide real, technical, concise, information-dense copy and functional widgets. |
| 9 | **Em-Dashes in Headlines/Copy** | Overused em-dashes indicate hollow marketing copy. | Write direct, concise sentences. Use periods, commas, or structured bullet hierarchies. |
| 10 | **Colored Left Stripe Callouts** | Left-border accent bars (`border-l-4 border-indigo-500`) are an overused documentation trope. | Use integrated tonal backgrounds, clean typographic hierarchy, or complete subtle border enclosures. |
| 11 | **Fake Testimonials** | Stock avatar circles with generic quotes kill credibility. | Show real metrics, concrete case studies, verifiable quotes, or omit testimonials entirely in favor of product proof. |
| 12 | **Bento Grids** | Randomly sized rounded boxes filled with fake miniature charts and switches are form over function. | Build task-oriented views, structured master-detail layouts, real data tables, or authentic product interfaces. |
| 13 | **Fake Terminal Windows** | macOS-style dark terminal mockups with red/yellow/green dots running fake commands are cliché. | Provide real, copyable code blocks with clean syntax highlighting or functional interactive shells. |
| 14 | **"It's Not X, It's Y" Copy** | Tired antithesis copywriting sounds pretentious. | State plainly and directly what the product does, how it works, and who it is built for. |
| 15 | **Checkmark Bullets** | Green checkmark icons beside every single feature bullet point are redundant visual noise. | Use clean typographic lists, standard dash/bullet markers, or parameter tables. |
| 16 | **3 Pricing Tiers with "Most Popular"** | The cookie-cutter Free / Pro (glowing "Popular" pill) / Enterprise trio feels manipulative and templated. | Present transparent pricing breakdowns, modular feature matrices, or clear usage-based calculators. |
| 17 | **No Real Product Demos** | Abstract 3D floating shapes and vague illustrations disguise a lack of real product substance. | Showcase actual high-fidelity, interactive UI components populated with realistic, rich data. |
| 18 | **Overly Soft Corner Radii (Bubble UI)** | Giant pill buttons (`rounded-full`), `rounded-3xl` cards, and bubbly shapes look juvenile. | Use tight, intentional geometry: `0px`, `2px`, `4px`, or maximum `6px`/`8px` where appropriate for system UI feel. |
| 19 | **Purple and Black (AI Dark Mode)** | Jet-black backgrounds paired with neon violet/purple glows are the hallmark of generic AI templates. | Use balanced charcoal/slate tones (`#121316`, `#18181B`, `#0F172A`) or refined light themes with high contrast. |
| 20 | **Skeleton Borders (Border-itis)** | Wrapping every single stat, paragraph, and line item in a border card creates clutter. | Establish hierarchy using whitespace, margin rhythm, surface color shifts, and typographic scale. |
| 21 | **Dot Grids and Mesh Overlays** | Faint SVG dot patterns, blueprint grids, and particle meshes add meaningless visual noise. | Use clean, quiet, unpatterned surfaces that let typography and data lead. |
| 22 | **Sparkle Icons (AI Sparkles)** | 4-pointed sparkle icons plastered everywhere to signify magic are an immediate indicator of slop. | Use descriptive functional verbs ("Analyze", "Compile", "Filter", "Automate") without decorative magic wands. |
| 23 | **Animated / Bouncing Arrows** | Bouncing down-arrows and sliding hover-arrow cues distract the user and feel patronizing. | Use static, confident visual hierarchy that guides reading flow naturally. |
| 24 | **Hover Animations for Everything** | Cards lifting, scaling up, and glowing on hover create motion fatigue. | Keep hover states subtle and restricted to clickable interactive controls (links, buttons, inputs). |
| 25 | **Neon Colors / Cyber Glow** | Eye-searing cyan, electric lime, and outer-glow effects hurt readability. | Use calibrated, accessible, print-inspired, or utilitarian digital color palettes meeting WCAG AAA/AA. |
| 26 | **Basic Pastel Colors** | Washed-out corporate pastel badges with low contrast. | Use solid, high-contrast, confident tones with legible foreground-to-background contrast ratios. |
| 27 | **Stacking Divs with Borders (Over-Nesting)** | Cards nested inside cards inside cards, each with individual borders, paddings, and outlines. | Use flat single-surface layouts, clean column dividers, or unified summary panels. |
| 28 | **Useless Status/Announcement Pills** | Decorative floating capsule badges (`STATUS: ONLINE`, `Ready to ship`, fake pulsing dots) clutter headings. | Restrict status indicators exclusively to live monitoring dashboards. Strip floating badge fluff from hero headers. |
| 29 | **Over-Explaining & Redundant Detail** | Slop markup routinely over-explains details with patronizing descriptions, redundant helper text, and paragraphs under self-evident controls or metrics. | If the data in said section is self-explanatory, keep it as concise as possible. Eliminate helper text, redundant subtitles, and descriptive bloat; let clear data speak for itself. |
| 30 | **Icon Soup (Decorative Icon Spam)** | Plastering Lucide/Feather icons beside every single heading, tab, table column, and list item. | Text-first hierarchy. Restrict icons strictly to standalone universal controls or essential visual scanning needs. |
| 31 | **Buzzwords & Marketing Hype** | Buzzwords and hollow marketing hype ("supercharge", "unleash", "seamlessly", "game-changing", "next-gen", "paradigm shift", "all-in-one", "blazing fast", "smart", "effortless") degrade credibility and clutter UI. | Embrace KISS (Keep It Simple, Stupid). Write clean, direct, factual technical prose describing exact mechanics and concrete outputs. Respect the user's intelligence: keep it clean and professional without dumbing down or patronizing. |
| 32 | **Fake Upward Trendlines** | Decorative SVG bezier curves curving upwards to simulate fake charts with no axes or units. | Render actual domain data with defined X/Y axes, units, scale markers, and inspection tooltips. |
| 33 | **Unanchored Vanity Metrics** | Giant floating stat counters ("99.9% Faster", "10x Productivity") without baseline context or benchmarks. | Specific, reproducible engineering benchmarks (e.g. "P99 latency < 1.2ms across 10M rows"). |
| 34 | **Low-Density "Desert" Layouts** | Massive padding (`py-32`, `p-16`) leaving 3 words per screen and forcing excessive scrolling. | Compact, information-dense, scannable desktop layouts designed for professional efficiency. |
| 35 | **Fake Marquee Logo Tickers** | Infinite scrolling CSS marquee strips with made-up grayscale partner logos ("Acme Corp"). | Static, verified customer case studies with concrete attribution, or omit social proof strips entirely. |
| 36 | **Heading Stacking & Eyebrow Bloat** | Stacking 3-4 redundant title tiers (Eyebrow Tag -> Giant H2 -> Subtitle Paragraph -> Card H3) before showing content. | Use single, confident headings or jump straight to data. If the title is clear, do not add an eyebrow or an explanatory subtitle. |
| 37 | **Faux-Editorial Typography (Pretentious Serifs on Slop Copy)** | Slapping editorial serif fonts (*Playfair Display, Instrument Serif, Fraunces*) on landing pages or cards to fake "taste" or editorial craft. An editorial font doesn't make content editorial if the copy and substance are poor. | Focus on real substance and clear copy first. Use robust, clean utilitarian typefaces (*Inter, Geist, SF Pro, JetBrains Mono, Public Sans*) suited for functional digital products. Reserve serifs strictly for genuine long-form publications. |
| 38 | **Random 3D / Three.js Floating Background Shapes** | Spinning 3D toruses, chrome spheres, glass blobs, and generic Three.js shader canvases floating aimlessly in backgrounds waste GPU resources and look like cliché template filler. | Suggest and render **actual domain 3D models** (e.g., interactive GLTF/GLB product models, CAD geometry, architectural assets, spatial hardware models) with concrete utility and real inspection controls unless the user explicitly requests abstract geometry. Otherwise, keep backgrounds clean and 2D. |
| 39 | **Reinventing Primitives & Ad-Hoc Component Duplication** | Writing one-off inline HTML/CSS wrappers and reinventing basic primitives (buttons, inputs, dialogs, badges, cards, tables) when existing components already exist creates fragmented, inconsistent UIs and code bloat. | **Always search for and reuse existing components first**. Audit the codebase / design system (e.g., `@/components/ui/*`, design tokens, shared primitives) and compose established components before authoring new markup. If a primitive is missing, build it as a reusable component. |

## Quick Installation

### Using `npx skills` (Recommended)

Install directly into your project or globally across all AI agents:

```bash
# Project-level install (adds to .agents/skills/)
npx skills add tuanphung2005/anti-ui-slop

# Global install (available across all projects/agents)
npx skills add tuanphung2005/anti-ui-slop -g
```

### Manual Installation

**Google Antigravity (Global Skill)**
```bash
# Windows
mkdir "%USERPROFILE%\.gemini\antigravity\skills\anti-ui-slop"
copy SKILL.md "%USERPROFILE%\.gemini\antigravity\skills\anti-ui-slop\SKILL.md"

# macOS / Linux
mkdir -p ~/.gemini/antigravity/skills/anti-ui-slop
cp SKILL.md ~/.gemini/antigravity/skills/anti-ui-slop/SKILL.md
```

**Claude Code**
Add the contents of `SKILL.md` to `CLAUDE.md` in your project root.

**Cursor & Windsurf**
Copy `SKILL.md` to `.cursorrules` or `.windsurfrules` in your project root.

## Code Comparison

### ❌ Slop Markup (Over-explaining details, status pills, buzzwords, icon soup, fake trendline, heading stacking)
```html
<div class="flex flex-col items-center bg-black py-24 px-8 text-center">
  <!-- Eyebrow Pill -->
  <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-900/30 border border-purple-500/40 text-purple-300 text-xs mb-4">
    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
    <span>STATUS: ONLINE | READY TO SHIP 🚀</span>
  </div>

  <!-- Giant Title + Over-Explaining Subtitle Stack -->
  <h1 class="text-5xl font-bold text-white">Supercharge Your Entire Workflow ✨</h1>
  <p class="text-neutral-400 text-sm max-w-lg mt-3">
    Unleash the power of our all-in-one next-generation platform. This section allows you to view, explore, and effortlessly manage all your database records in one single comprehensive place.
  </p>

  <!-- Vanity Metrics with Redundant Microcopy Explanations -->
  <div class="flex gap-12 mt-8 text-white">
    <div>
      <div class="text-3xl font-bold text-purple-400">10x</div>
      <div class="text-xs text-neutral-400 font-semibold">Faster Execution</div>
      <p class="text-[10px] text-neutral-500 max-w-xs mt-1">Queries run ten times faster than conventional database query tools.</p>
    </div>
    <div>
      <div class="text-3xl font-bold text-purple-400">99.9%</div>
      <div class="text-xs text-neutral-400 font-semibold">Time Saved</div>
      <p class="text-[10px] text-neutral-500 max-w-xs mt-1">Eliminates manual index configuration time across your team.</p>
    </div>
  </div>

  <!-- Bento Card with Over-Explained Fake Chart -->
  <div class="grid grid-cols-3 gap-6 mt-10">
    <div class="p-8 rounded-3xl bg-gradient-to-br from-purple-900/50 to-black border border-purple-500/30 shadow-2xl hover:-translate-y-2 transition-all text-left">
      <div class="text-3xl mb-2">⚡</div>
      <h3 class="text-xl font-bold text-white">Realtime Analytics</h3>
      <p class="text-xs text-neutral-400 mt-1">This real-time graph visualizes your queries per second streaming live from edge instances.</p>
      <svg class="w-full h-16 stroke-purple-400 fill-none mt-2" viewBox="0 0 100 40">
        <path d="M0 35 Q 25 30, 50 15 T 100 5" stroke-width="2" />
      </svg>
    </div>
  </div>
</div>
```

### ✅ Clean Utilitarian Markup (Concise, self-explanatory data, single heading, high contrast, real metrics)
```html
<div class="bg-neutral-900 text-neutral-100 p-8 border-b border-neutral-800">
  <div class="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
    <div>
      <h2 class="text-2xl font-semibold tracking-tight text-neutral-50">Sub-millisecond query execution</h2>
      <p class="text-neutral-400 text-sm mt-2 leading-relaxed">
        Direct memory-mapped indexing reduces query overhead across large dataset joins.
      </p>
    </div>
    <div class="bg-neutral-950 p-4 rounded-sm border border-neutral-800 font-mono text-xs text-neutral-300 space-y-2">
      <div class="flex justify-between border-b border-neutral-800 pb-1 text-neutral-500">
        <span>ENGINE</span>
        <span>P99 (ms)</span>
        <span>THROUGHPUT</span>
      </div>
      <div class="flex justify-between">
        <span class="text-neutral-100">Engine Core</span>
        <span class="text-emerald-400">0.82 ms</span>
        <span>142k ops/s</span>
      </div>
      <div class="flex justify-between text-neutral-400">
        <span>Standard Node</span>
        <span>4.15 ms</span>
        <span>28k ops/s</span>
      </div>
    </div>
  </div>
</div>
```

## License

MIT License. See [LICENSE](LICENSE) for details.
