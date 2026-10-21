---
name: anti-ui-slop
description: "Enforces strict anti-slop frontend and UI/UX design standards. Bans generic modern AI/SaaS design clichés (harsh gradients, bento grids, fake terminals, emojis, purple-on-dark, useless status pills, icon soup, buzzwords, fake charts, heading stacking bloat, over-nesting, over-explaining detail, faux-editorial serifs on bad copy, piss-white/blueish-gray palettes, random floating 3D/Three.js shapes, reinventing existing components, etc.). Mandates KISS (Keep It Simple, Stupid), searching for and reusing existing components before creating new ones, pleasing eye-friendly neutrals, crisp typography, zero buzzwords, actual 3D models when 3D is used, and clean, high-craft, functional interfaces that respect user intelligence without dumbing down. Use whenever designing, reviewing, building, or refactoring user interfaces, landing pages, CSS, or web components."
---

# Anti-UI-Slop Design Guidelines

This standard enforces high-craft, durable, and functional UI engineering by banning generic modern web design clichés ("UI Slop") and prescribing clean, purposeful, content-first alternatives.

## The 39 Prohibitions & Prescribed Alternatives

| # | Prohibited Cliché ("Slop") | Why It's Banned | Mandatory Alternative |
|---|---|---|---|
| **1** | **Harsh Gradients** | Multi-stop high-contrast linear/radial gradients create visual noise and cheapen the UI. | Use solid, calibrated background tones or flat intentional surfaces. If subtle depth is required, use single-hue opacity shifts. |
| **2** | **Pure White (`#FFFFFF`), "Piss White" & Murky Blueish Gray** | Stark `#ffffff` causes glare, while yellowed "piss white" cream (`#FAF9F5`) and dreary cold "blueish gray" washes look dirty, muddy, and cheap. | Use pleasing, clean, balanced neutrals: crisp modern off-whites (`#F9F9FB`, `#F4F4F6`, `#F8F9FA`, `#F5F5F7`, `#FAFAFA`) or refined charcoals (`#121316`, `#18181B`). Recommend genuinely pleasing, eye-friendly tones that avoid yellow/parchment discoloration and muddy blueish grays. |
| **3** | **Rainbow Coloring** | Throwing 5+ bright accent colors across badges, cards, and buttons creates visual chaos. | Restrict to a disciplined palette: 1 primary brand color, 1 neutral scale, and strict semantic colors (success/error) only where functional. |
| **4** | **Drop Shadows** | Muddy, fuzzy `box-shadow` spreads (`0 20px 40px rgba(...)`) look sloppy and dated. | Use crisp 1px borders, subtle tone-on-tone elevation changes, or flat geometric boundaries. |
| **5** | **3 Feature Cards in a Row** | The ubiquitous 3-column "Icon + Title + 2 sentences" layout is lazy and content-free. | Use asymmetric layouts, split-screen interactive deep-dives, tabular specs, or contextual workflow walkthroughs. |
| **6** | **Emojis in UI / Copy** | Emojis (🚀, 🔥, 💡, ⚡, ✨, 📈) degrade professional typography and feel like cheap templates. | Use precise typography and clean vector SVG icons only when strictly necessary for clarity. |
| **7** | **Liquid Glass / Glassmorphism** | `backdrop-filter: blur()` and milky translucent borders (`rgba(255,255,255,0.1)`) hurt readability and performance. | Use solid, opaque surfaces with high contrast and legible content. |
| **8** | **Vague Marketing Fillers** | Low-information placeholder copy and decorative fluff waste screen space. | Provide real, technical, concise, information-dense copy and functional widgets. |
| **9** | **Em-Dashes in Headlines/Copy** | Overused em-dashes (`—`) in headlines ("Fast — reliable — scale") indicate hollow marketing copy. | Write direct, concise sentences. Use periods, commas, or structured bullet hierarchies. |
| **10** | **Colored Left Stripe Callouts** | Left-border accent bars (`border-l-4 border-indigo-500`) are a tired documentation/blog trope. | Use integrated tonal backgrounds, clean typographic hierarchy, or complete subtle border enclosures. |
| **11** | **Fake Testimonials** | Stock avatar circles with generic quotes ("John Doe, CTO at Startup") kill credibility. | Show real metrics, concrete case studies, verifiable quotes, or omit testimonials entirely in favor of product proof. |
| **12** | **Bento Grids** | Randomly sized rounded boxes filled with fake miniature charts and switches are form over function. | Build task-oriented views, structured master-detail layouts, real data tables, or authentic product interfaces. |
| **13** | **Fake Terminal Windows** | macOS-style dark terminal mockups with red/yellow/green dots running fake `npm install` are cliché. | Provide real, copyable code blocks with clean syntax highlighting or functional interactive shells. |
| **14** | **"It's Not X, It's Y" Copy** | Tired antithesis copywriting ("It's not a CRM, it's a relationship engine") sounds pretentious. | State plainly and directly what the product does, how it works, and who it is built for. |
| **15** | **Checkmark Bullets** | Green checkmark icons (`✓`, `✔`, `🟢`) beside every single feature bullet point are redundant visual noise. | Use clean typographic lists, standard dash/bullet markers, or parameter tables. |
| **16** | **3 Pricing Tiers with "Most Popular"** | The cookie-cutter Free / Pro (glowing "Popular" pill) / Enterprise trio feels manipulative and templated. | Present transparent pricing breakdowns, modular feature matrices, or clear usage-based calculators. |
| **17** | **No Real Product Demos** | Abstract 3D floating shapes and vague illustrations disguise a lack of real product substance. | Showcase actual high-fidelity, interactive UI components populated with realistic, rich data. |
| **18** | **Overly Soft Corner Radii (Bubble UI)** | Giant pill buttons (`rounded-full`), `rounded-3xl` cards, and bubbly shapes look juvenile. | Use tight, intentional geometry: `0px`, `2px`, `4px`, or maximum `6px`/`8px` where appropriate for system UI feel. |
| **19** | **Purple and Black (AI Dark Mode)** | Jet-black backgrounds paired with neon violet/purple glows are the hallmark of generic AI templates. | Use balanced charcoal/slate tones (`#121316`, `#18181B`, `#0F172A`) or refined light themes with high contrast. |
| **20** | **Skeleton Borders (Border-itis)** | Wrapping every single stat, paragraph, and line item in a `border border-slate-700` card creates clutter. | Establish hierarchy using whitespace, margin rhythm, surface color shifts, and typographic scale. |
| **21** | **Dot Grids & Mesh Overlays** | Faint SVG dot patterns, blueprint grids, and particle meshes add meaningless visual noise. | Use clean, quiet, unpatterned surfaces that let typography and data lead. |
| **22** | **Sparkle Icons (✨ / AI Sparkles)** | 4-pointed sparkle icons plastered everywhere to signify "AI magic" are an immediate indicator of slop. | Use descriptive functional verbs ("Analyze", "Compile", "Filter", "Automate") without decorative magic wands. |
| **23** | **Animated / Bouncing Arrows** | Bouncing down-arrows and sliding hover-arrow cues distract the user and feel patronizing. | Use static, confident visual hierarchy that guides reading flow naturally. |
| **24** | **Hover Animations for Everything** | Cards lifting (`translate-y-1`), scaling up, and glowing on hover create motion fatigue. | Keep hover states subtle and restricted to clickable interactive controls (links, buttons, inputs). |
| **25** | **Neon Colors / Cyber Glow** | Eye-searing cyan, electric lime, and outer-glow `box-shadow` effects hurt readability. | Use calibrated, accessible, print-inspired, or utilitarian digital color palettes meeting WCAG AAA/AA. |
| **26** | **Basic Pastel Colors** | Washed-out corporate pastel badges (pale peach, baby pink, muted mint) with low contrast. | Use solid, high-contrast, confident tones with legible foreground-to-background contrast ratios. |
| **27** | **Stacking Divs with Borders (Over-Nesting)** | Cards nested inside cards inside cards, each with individual borders, paddings, and outlines. | Use flat single-surface layouts, clean column dividers, or unified summary panels. |
| **28** | **Useless Status/Announcement Pills** | Decorative floating capsule badges (`STATUS: ONLINE`, `Ready to ship`, `v2.0 is live →`, fake pulsing dots) clutter headings. | Only display status indicators in real monitoring dashboards where live operational telemetry is measured. |
| **29** | **Over-Explaining & Redundant Detail** | Slop markup routinely over-explains details with patronizing descriptions, redundant helper text, and paragraphs under self-evident controls or metrics. | If the data in said section is self-explanatory, keep it as concise as possible. Eliminate helper text, redundant subtitles, and descriptive bloat; let clear data speak for itself. |
| **30** | **Icon Soup (Decorative Icon Spam)** | Plastering Lucide/Feather icons beside every single heading, tab, table column, and list item. | Text-first hierarchy. Restrict icons strictly to standalone universal controls or essential visual scanning needs. |
| **31** | **Buzzwords & Marketing Hype** | Buzzwords and hollow marketing hype ("supercharge", "unleash", "seamlessly", "game-changing", "next-gen", "paradigm shift", "all-in-one", "blazing fast", "smart", "effortless") degrade credibility and clutter UI. | Embrace KISS (Keep It Simple, Stupid). Write clean, direct, factual technical prose describing exact mechanics and concrete outputs. Respect the user's intelligence: keep it clean and professional without dumbing down or patronizing. |
| **32** | **Fake Upward Trendlines** | Decorative SVG bezier curves curving upwards to simulate fake charts with no axes or units. | Render actual domain data with defined X/Y axes, units, scale markers, and inspection tooltips. |
| **33** | **Unanchored Vanity Metrics** | Giant floating stat counters ("99.9% Faster", "10x Productivity") without baseline context or benchmarks. | Specific, reproducible engineering benchmarks (e.g. "P99 latency < 1.2ms across 10M rows"). |
| **34** | **Low-Density "Desert" Layouts** | Massive padding (`py-32`, `p-16`) leaving 3 words per screen and forcing excessive scrolling. | Compact, information-dense, scannable desktop layouts designed for professional efficiency. |
| **35** | **Fake Marquee Logo Tickers** | Infinite scrolling CSS marquee strips with made-up grayscale partner logos ("Acme Corp"). | Static, verified customer case studies with concrete attribution, or omit social proof strips entirely. |
| **36** | **Heading Stacking & Eyebrow Bloat** | Stacking 3-4 redundant title tiers (Eyebrow Tag -> Giant H2 -> Subtitle Paragraph -> Card H3) before showing content. | Use single, confident headings or jump straight to data. If the title is clear, do not add an eyebrow or an explanatory subtitle. |
| **37** | **Faux-Editorial Typography (Pretentious Serifs on Slop Copy)** | Slapping editorial serif fonts (*Playfair Display, Instrument Serif, Fraunces, Cormorant Garamond*) on landing pages or cards to fake "taste" or editorial craft. An editorial font doesn't make content editorial if the copy and substance are poor. | Focus on real substance and clear copy first. Use robust, clean utilitarian typefaces (*Inter, Geist, SF Pro, JetBrains Mono, Public Sans*) suited for functional digital products. Reserve serifs strictly for genuine long-form publications. |
| **38** | **Random 3D / Three.js Floating Background Shapes** | Spinning 3D toruses, chrome spheres, glass blobs, and generic Three.js shader canvases floating aimlessly in backgrounds waste GPU resources and look like cliché template filler. | Suggest and render **actual domain 3D models** (e.g., interactive GLTF/GLB product models, CAD geometry, architectural assets, spatial hardware models) with concrete utility and real inspection controls unless the user explicitly requests abstract geometry. Otherwise, keep backgrounds clean and 2D. |
| **39** | **Reinventing Primitives & Ad-Hoc Component Duplication** | Writing one-off inline HTML/CSS wrappers and reinventing basic primitives (buttons, inputs, dialogs, badges, cards, tables) when existing components already exist creates fragmented, inconsistent UIs and code bloat. | **Always search for and reuse existing components first**. Audit the codebase / design system (e.g., `@/components/ui/*`, design tokens, shared primitives) and compose established components before authoring new markup. If a primitive is missing, build it as a reusable component. |

## Architectural Principles

1. **Function Over Ornamentation**: Every pixel, line, and word must deliver utility. If removing an element does not reduce comprehension, delete it.
2. **Search for Reusable Components First**: Always search the existing codebase and design system (e.g., `components/`, `@/components/ui/`, design tokens) before writing new UI elements or markup. Never reinvent established buttons, inputs, dialogs, cards, or tables with ad-hoc one-off HTML/CSS. Reuse and compose existing primitives; if a new primitive is genuinely required, construct it as an extensible, reusable component.
3. **Embrace KISS (Keep It Simple, Stupid)**: Build simple, direct, uncluttered layouts and clean DOM structures. Avoid over-engineered visual wrappers, complex nested containers, and decorative gimmicks.
4. **Respect User Intelligence (Clean, Not Dumbed Down)**: Keeping interfaces clean and concise does not mean dumbing content down into condescending, preschool phrasing or insulting the user. Use precise, professional, domain-accurate terminology directly—without patronizing explanations, hand-holding, or marketing filler.
5. **Zero Buzzwords & Zero Marketing Hype**: Ban all buzz-verbs, hyperbole, and empty corporate jargon (*supercharge, unleash, seamlessly, next-gen, paradigm shift, game-changing, all-in-one, blazing-fast, smart, effortless*). Write concrete, engineering-grade statements describing exact capabilities, inputs, and outputs.
6. **Real 3D Over Random Three.js Shapes**: Never clutter backgrounds with random spinning 3D primitives or floating chrome/glass blobs. If 3D rendering is used, suggest and use **actual domain 3D models** (e.g. GLTF/GLB product assets, CAD models) that provide genuine utility, unless abstract shapes are explicitly specified.
7. **Typography Follows Substance (No Faux-Editorial Dressing)**: Slapping an "editorial" serif font on weak, generic copy does not make it editorial. Typography cannot mask bad content. Use clean, highly legible utilitarian fonts (*Inter, Geist, SF Pro, JetBrains Mono, Public Sans*).
8. **Pleasing, Calibrated Neutral Palettes (No "Piss White" or Murky Blueish Gray)**: Never use glaring pure `#FFFFFF`, discolored yellowish/cream "piss white" (`#FAF9F5`, yellow parchment), or dreary cold "blueish gray" washes to simulate warmth or depth. When pleasing colors are needed, suggest crisp, balanced, modern neutrals (*#F9F9FB, #F4F4F6, #F8F9FA, #F5F5F7, #FAFAFA, #121316, #18181B*).
9. **Conciseness Over Detail Over-Explanation**: Slop markup is characterized by over-explaining details (unnecessary descriptive paragraphs under self-evident data, excessive labels, redundant tooltips). If the data in a given section is self-explanatory, keep both the copy and DOM structure as concise as possible. Every element must earn its place.
10. **Spatial & Surface Restraint**: Avoid drawing borders around every container. Prioritize high-contrast opaque surfaces and desktop-class information density.

## Code Comparison

### ❌ Slop Markup (Over-explaining details, status pills, buzzwords, icon soup, fake trendline, heading stacking):
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

### ✅ Clean Utilitarian Markup (Concise, self-explanatory data, single heading, high contrast, real metrics):
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

## Review Checklist for Frontends

- [ ] **Search and reuse existing components first**: Checked the codebase and design system (e.g. `@/components/ui`, design tokens) before creating new primitives or writing bespoke markup.
- [ ] **Embrace KISS (Keep It Simple, Stupid)**: Flat, direct, and uncluttered layout; no over-engineered wrappers, bloated widget hierarchies, or convoluted structures.
- [ ] **Zero buzzwords or marketing hype**: No "supercharge", "unleash", "seamlessly", "next-gen", "paradigm shift", "all-in-one", "game-changing", "blazing fast", "smart", "effortless", or hollow claims.
- [ ] **Clean & professional without dumbing down**: Respect user intelligence with precise, domain-accurate terminology; never patronize, talk down, or use childish phrasing.
- [ ] **No faux-editorial serifs on weak content**: Do not slap pretentious serif fonts (*Playfair Display, Instrument Serif, Fraunces*) over low-substance copy to fake sophistication.
- [ ] **Pleasing, non-discolored color palette**: No blinding `#FFFFFF` glare, no yellowed "piss white" (`#FAF9F5`) cream, and no dreary "blueish gray" washes. Recommend crisp, eye-friendly neutrals (*#F9F9FB, #F4F4F6, #F8F9FA, #FAFAFA, #121316, #18181B*).
- [ ] **No over-explaining self-explanatory data**: If data, inputs, or UI controls in a section are self-explanatory, keep copy and markup as concise as possible; omit redundant helper text.
- [ ] **No redundant microcopy, helper paragraphs, or explanatory subtitles where context is self-evident.**
- [ ] **No heading stacking or eyebrow bloat (no Eyebrow + H2 + Subtitle + Card H3 chains).**
- [ ] **No useless floating status / announcement pill badges (`STATUS: ONLINE`, `Ready to ship`, fake pulsing dots).**
- [ ] **No icon soup (no decorative icons placed beside every label, column, and button).**
- [ ] **No unanchored vanity metrics ("10x faster" without benchmark methodology).**
- [ ] **No fake upward bezier trendlines or decorative SVG charts.**
- [ ] **No fake infinite scrolling logo marquees.**
- [ ] **No low-density "desert" layouts with massive empty padding (`py-32`).**
- [ ] **No harsh gradients or purple-on-black neon glows.**
- [ ] **No emojis in titles, lists, or buttons.**
- [ ] **No decorative sparkle (`✨`) icons or magical wand emblems.**
- [ ] **No fake terminal windows with red/yellow/green macOS dots.**
- [ ] **No 3-card generic feature rows.**
- [ ] **No cookie-cutter 3-tier pricing cards with glowing "Most Popular" tags.**
- [ ] **No checkmark icon feature bullet lists.**
- [ ] **No "It's not X, It's Y" cliché copy.**
- [ ] **No em-dashes (`—`) in headers or marketing tags.**
- [ ] **No over-nested boxes (`border` inside `border` inside `border`).**
- [ ] **No generic bento grids or meaningless dot grid / graph background patterns.**
- [ ] **No excessive bubble border radii (`rounded-3xl`, `rounded-full` everywhere).**
- [ ] **No excessive hover movement (`hover:-translate-y-2` on non-interactive items).**
- [ ] **No random floating 3D / Three.js background shapes**: If 3D is needed, use actual domain 3D models (GLTF/GLB assets, CAD files) unless abstract geometry is explicitly requested.
- [ ] **Real interactive UI / data shown instead of abstract placeholders.**
