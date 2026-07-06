# README Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign FlixMonkey's README.md to improve user onboarding, engagement, and clarity

**Architecture:** Single-page markdown redesign with visual hierarchy prioritizing user needs. Developer content minimized and linked to CONTRIBUTING.md.

**Tech Stack:** Markdown, shields.io badges

## Global Constraints

- Primary audience: General Netflix users (non-technical)
- Priority order: Better onboarding > More engaging > Clearer structure > Complete reference
- All external links must be validated
- User-facing labels for defaults (not internal values)
- Screenshots must be anonymized (no personal data)

---

## File Structure

### Files to Modify

- `README.md` - Complete rewrite

### Files to Create

- `screenshots/hero.png` - Main hero screenshot
- `screenshots/thumbnails.png` - Thumbnail grid screenshot
- `screenshots/hover.png` - Hover card screenshot
- `screenshots/modal.png` - Preview modal screenshot

### Files to Reference (Read-Only)

- `package.json` - Version number for badge
- `LICENSE` - License type for badge
- `CONTRIBUTING.md` - May need minor updates

---

## Implementation Tasks

### Task 1: Create Screenshots Directory

**Files:**

- Create: `screenshots/` directory

**Interfaces:**

- Produces: Directory structure for screenshot assets

- [ ] **Step 1: Create screenshots directory**

Run: `mkdir -p screenshots`
Expected: Directory created at `/screenshots`

- [ ] **Step 2: Create .gitkeep file**

Run: `touch screenshots/.gitkeep`
Expected: .gitkeep file created

- [ ] **Step 3: Commit directory creation**

```bash
git add screenshots/.gitkeep
git commit -m "chore: create screenshots directory for README assets"
```

---

### Task 2: Create README Hero Section

**Files:**

- Modify: `README.md` (lines 1-10)

**Interfaces:**

- Produces: Hero section with project name, screenshot, badges, tagline

- [ ] **Step 1: Write hero section content**

```markdown
# FlixMonkey

![FlixMonkey screenshot showing rating badges on Netflix thumbnails](screenshots/hero.png)

[![License: GPLv3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Version 1.3.0](https://img.shields.io/badge/version-1.3.0-green.svg)](https://github.com/fran2889/flix-monkey/releases)

See IMDb, Metacritic, and Rotten Tomatoes ratings while browsing Netflix.
```

- [ ] **Step 2: Verify hero section renders correctly**

Run: Open the markdown preview to verify badges display properly
Expected: Badges render with correct colors and links

- [ ] **Step 3: Commit hero section**

```bash
git add README.md
git commit -m "docs(readme): add hero section with screenshot and badges"
```

---

### Task 3: Add Screenshot Gallery

**Files:**

- Modify: `README.md` (after hero section)

**Interfaces:**

- Produces: Screenshot gallery section

- [ ] **Step 1: Write screenshot gallery section**

```markdown
## How it looks

![Rating badges on Netflix thumbnails](screenshots/thumbnails.png)
![Hover card with ratings](screenshots/hover.png)
![Preview modal with ratings](screenshots/modal.png)
```

- [ ] **Step 2: Verify gallery formatting**

Run: Check markdown preview shows images in sequence
Expected: Three screenshots display in order

- [ ] **Step 3: Commit screenshot gallery**

```bash
git add README.md
git commit -m "docs(readme): add screenshot gallery"
```

---

### Task 4: Add Installation Section with Badge Links

**Files:**

- Modify: `README.md` (after screenshot gallery)

**Interfaces:**

- Produces: Installation section with platform badge links

- [ ] **Step 1: Write installation section**

```markdown
## Installation

### Chrome Extension

[![Install for Chrome](https://img.shields.io/badge/Chrome-Install-black?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/flixmonkey/ipbiebdbicmlajmbcghkcdkobmcaoadl)

### Firefox Add-on

[![Install for Firefox](https://img.shields.io/badge/Firefox-Install-orange?logo=firefox&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/flixmonkey/)

### Userscript

[![Install Userscript](https://img.shields.io/badge/Userscript-Install-green?logo=tampermonkey&logoColor=white)](https://raw.githubusercontent.com/fran2889/flix-monkey/main/FlixMonkey.user.js)
_Requires [Tampermonkey for Chrome](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo), [Tampermonkey for Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/), or [Violentmonkey](https://violentmonkey.github.io/)_
```

- [ ] **Step 2: Verify badge links are correct**

Run: Click each badge link in preview to verify URLs
Expected: All links open correct store pages

- [ ] **Step 3: Commit installation section**

```bash
git add README.md
git commit -m "docs(readme): add installation section with store badge links"
```

---

### Task 5: Add Features Section

**Files:**

- Modify: `README.md` (after installation)

**Interfaces:**

- Produces: Features section with benefit-focused bullet points

- [ ] **Step 1: Write features section**

```markdown
## Features

✅ **Rating Badges** - IMDb, Metacritic, Rotten Tomatoes scores on thumbnails, hover cards, and modals
✅ **Smart Caching** - Fast lookups for titles you've seen before
✅ **Auto-Disable** - Failing APIs are temporarily disabled to prevent lag
✅ **Click to Open** - Click badges to open the IMDb page
✅ **Customizable** - Change badge position, choose API provider, and more
```

- [ ] **Step 2: Verify features display correctly**

Run: Check markdown preview renders checkmarks and formatting
Expected: All features display with checkmark emojis

- [ ] **Step 3: Commit features section**

```bash
git add README.md
git commit -m "docs(readme): add features section with benefit statements"
```

---

### Task 6: Add Configuration Section with All Settings

**Files:**

- Modify: `README.md` (after features)

**Interfaces:**

- Produces: Comprehensive configuration section with all settings

- [ ] **Step 1: Write configuration section**

```markdown
## Settings

Access settings via:

- **Extensions**: Click the FlixMonkey icon in your browser toolbar → **Options**
- **Userscript**: Right-click the userscript manager icon on Netflix → **FlixMonkey Settings**

### Display Options

| Option                    | Default  | Description                                   |
| ------------------------- | -------- | --------------------------------------------- |
| **Overlay Position**      | Top Left | Corner where rating badges appear             |
| **Show Rotten Tomatoes**  | No       | Display RT score (requires OMDB key)          |
| **Show Metacritic**       | No       | Display Metacritic score                      |
| **Fade Thumbnails**       | No       | Fade thumbnails below rating threshold        |
| **Fade Rating Threshold** | 6.0      | IMDb rating below which to fade               |
| **Show Fade Toggle**      | No       | Show button to override fade in hover preview |

### API & Data

| Option                     | Default  | Description                                                            |
| -------------------------- | -------- | ---------------------------------------------------------------------- |
| **API Client**             | Agregarr | Primary rating provider (Agregarr, IMDb API, OMDB, XMDB)               |
| **OMDB API Key**           | _empty_  | [Get a free key](https://www.omdbapi.com/apikey.aspx) for RT/MC scores |
| **XMDB API Key**           | _empty_  | [Get a free key](https://xmdbapi.com/api-key) for additional data      |
| **Cache TTL (Old Titles)** | Forever  | Cache duration for rated titles > 1 year old                           |
| **Cache TTL (New Titles)** | 30 days  | Cache duration for rated titles < 1 year old                           |
| **Cache TTL (No Rating)**  | 1 day    | Cache duration for unrated/not-found titles                            |

### Advanced

| Option         | Default | Description                    |
| -------------- | ------- | ------------------------------ |
| **Debug Mode** | Yes     | Enable verbose console logging |
```

- [ ] **Step 2: Verify table formatting**

Run: Check markdown preview renders tables correctly
Expected: All tables display with proper alignment

- [ ] **Step 3: Commit configuration section**

```bash
git add README.md
git commit -m "docs(readme): add comprehensive configuration section with all settings"
```

---

### Task 7: Add Troubleshooting Section

**Files:**

- Modify: `README.md` (after configuration)

**Interfaces:**

- Produces: Troubleshooting FAQ section

- [ ] **Step 1: Write troubleshooting section**

```markdown
## Troubleshooting

**No badges appearing?** Refresh Netflix or check if the extension is enabled.
**Need fresh ratings?** Clear cache in settings.
**Slow performance?** Reset disabled APIs in settings.
**Still having issues?** Open a [GitHub issue](https://github.com/fran2889/flix-monkey/issues).
```

- [ ] **Step 2: Verify troubleshooting links**

Run: Verify GitHub issue link works
Expected: Link opens to correct repository issues page

- [ ] **Step 3: Commit troubleshooting section**

```bash
git add README.md
git commit -m "docs(readme): add troubleshooting FAQ section"
```

---

### Task 8: Add Development Section

**Files:**

- Modify: `README.md` (after troubleshooting)

**Interfaces:**

- Produces: Minimal development section with basic build info

- [ ] **Step 1: Write development section**

````markdown
## Development

FlixMonkey is built with Node.js (>= 24).

```bash
npm install
npm run build
```
````

See [CONTRIBUTING.md](CONTRIBUTING.md) for full development setup.

````

- [ ] **Step 2: Verify development section links**

Run: Verify CONTRIBUTING.md link works
Expected: Link opens to correct file

- [ ] **Step 3: Commit development section**

```bash
git add README.md
git commit -m "docs(readme): add minimal development section with build info"
````

---

### Task 9: Add Footer with Privacy and License

**Files:**

- Modify: `README.md` (after development)

**Interfaces:**

- Produces: Footer section with privacy policy and license

- [ ] **Step 1: Write footer section**

```markdown
## Privacy Policy

FlixMonkey does not collect, store, or transmit any personal data about you.

**What it does:**

- **Title lookups**: When you browse Netflix, the title names visible on the page are sent to third-party rating APIs (Agregarr, IMDb API, OMDB, XMDB) solely to retrieve ratings. No account information, viewing history, or Netflix credentials are included in these requests.
- **Local storage only**: All cached ratings, settings, and API keys are stored exclusively in your browser's local extension storage (or userscript storage). This data never leaves your device except as part of the API requests described above.
- **No telemetry**: FlixMonkey does not include any analytics, crash reporting, or usage tracking of any kind.
- **No developer servers**: All network requests go directly from your browser to the third-party rating APIs. There is no intermediary server operated by this project.

**Third-party APIs:**

By default, title lookups are resolved via [IMDb](https://www.imdb.com/) suggestions and ratings are fetched from [Agregarr](https://github.com/agregarr/agregarr). When OMDB or XMDB is selected, requests are made to [omdbapi.com](https://www.omdbapi.com/) and/or [xmdbapi.com](https://xmdbapi.com/). The [IMDb API](https://api.imdbapi.dev/) is also available as an alternative provider. Your use of these services is subject to their respective privacy policies.

## License

[GPLv3](LICENSE)
```

- [ ] **Step 2: Verify footer links**

Run: Verify all external links in privacy policy work
Expected: IMDb, Agregarr, OMDB, XMDB, IMDb API links all valid

- [ ] **Step 3: Commit footer section**

```bash
git add README.md
git commit -m "docs(readme): add footer with privacy policy and license"
```

---

### Task 10: Remove Old Content from README

**Files:**

- Modify: `README.md` (entire file)

**Interfaces:**

- Consumes: All new sections from Tasks 2-9
- Produces: Final README.md with old content removed

- [ ] **Step 1: Review current README.md**

Run: `wc -l README.md` to check line count
Expected: Should be significantly longer than original due to new content

- [ ] **Step 2: Verify all old sections are replaced**

Check that these old sections are NOT present:

- Old hero without badges
- Old installation with manual steps
- Architecture section
- Detailed build process
- Developer workflow
- Old configuration format

- [ ] **Step 3: Final verification of complete README**

Run: Read through entire README.md
Expected: Flows from hero → screenshots → installation → features → configuration → troubleshooting → development → footer

- [ ] **Step 4: Commit final README cleanup**

```bash
git add README.md
git commit -m "docs(readme): finalize README redesign with all new sections"
```

---

### Task 11: Update CONTRIBUTING.md (Optional)

**Files:**

- Modify: `CONTRIBUTING.md` (if needed)

**Interfaces:**

- Consumes: README development info removal
- Produces: Enhanced CONTRIBUTING.md with moved content

- [ ] **Step 1: Check if CONTRIBUTING needs updates**

Run: Compare old README with CONTRIBUTING.md
Expected: Identify any gaps where developer info was in README but not in CONTRIBUTING

- [ ] **Step 2: Add missing developer content if needed**

If gaps found, add content from old README to CONTRIBUTING.md

- [ ] **Step 3: Commit CONTRIBUTING updates if made**

```bash
git add CONTRIBUTING.md
git commit -m "docs: move developer info from README to CONTRIBUTING"
```

- [ ] **Step 4: If no changes needed, skip this task**

---

### Task 12: Create Screenshots (Manual Task)

**Files:**

- Create: `screenshots/hero.png`
- Create: `screenshots/thumbnails.png`
- Create: `screenshots/hover.png`
- Create: `screenshots/modal.png`

**Interfaces:**

- Produces: All screenshot assets for README

- [ ] **Step 1: Capture hero screenshot**

Create: `screenshots/hero.png` showing FlixMonkey rating badges on Netflix thumbnails
Requirements: High quality, anonymized, shows value proposition clearly

- [ ] **Step 2: Capture thumbnail grid screenshot**

Create: `screenshots/thumbnails.png` showing badges on browse grid

- [ ] **Step 3: Capture hover card screenshot**

Create: `screenshots/hover.png` showing ratings on hover preview

- [ ] **Step 4: Capture modal screenshot**

Create: `screenshots/modal.png` showing ratings on preview modal

- [ ] **Step 5: Optimize and commit screenshots**

Run: Optimize images for web (compress if needed)

```bash
git add screenshots/*.png
git commit -m "docs: add README screenshot assets"
```

---

### Task 13: Final Verification and Testing

**Files:**

- Verify: `README.md`
- Verify: `screenshots/` directory
- Verify: `CONTRIBUTING.md` (if modified)

**Interfaces:**

- Consumes: All previous task outputs
- Produces: Verified complete implementation

- [ ] **Step 1: Verify README structure**

Run: Read README.md end-to-end
Expected: All sections present in correct order, no typos, all links valid

- [ ] **Step 2: Test all external links**

Test each link in README:

- Chrome Web Store
- Firefox Add-ons
- Tampermonkey Chrome
- Tampermonkey Firefox
- Violentmonkey
- Userscript raw file
- OMDB API key page
- XMDB API key page
- GitHub issues
- License file
- CONTRIBUTING.md
  Expected: All links open correctly

- [ ] **Step 3: Verify markdown rendering**

Run: Open README.md in GitHub preview or markdown editor
Expected: All formatting correct (tables, lists, badges, images)

- [ ] **Step 4: Check git history**

Run: `git log --oneline -20`
Expected: All commits from Tasks 1-12 present with descriptive messages

- [ ] **Step 5: Final commit if any fixes needed**

If any issues found, fix and commit:

```bash
git add .
git commit -m "fix(readme): address final verification issues"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: All design decisions from spec are implemented in tasks
    - Hero section with badges: Task 2
    - Screenshot gallery: Task 3
    - Installation with store badges: Task 4
    - Features section: Task 5
    - Configuration with all settings: Task 6
    - Troubleshooting: Task 7
    - Development section: Task 8
    - Footer: Task 9
    - Screenshots: Task 12
- [x] **Placeholder scan**: No TBDs, TODOs, or placeholders found
- [x] **Type consistency**: No type inconsistencies (all file paths exact, all markdown syntax consistent)
- [x] **Scope check**: Each task is bite-sized (2-5 minutes) with clear deliverables

**Plan complete and saved to `docs/superpowers/plans/2026-07-06-readme-redesign-plan.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
