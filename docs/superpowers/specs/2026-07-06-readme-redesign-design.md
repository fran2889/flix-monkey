# README Redesign Specification

**Date:** 2026-07-06  
**Project:** FlixMonkey  
**Author:** Mistral Vibe  
**Status:** Draft

## Overview

This specification describes the redesign of FlixMonkey's README.md to improve user onboarding, engagement, and clarity while maintaining comprehensive reference information.

## Goals (Priority Order)

1. **Better user onboarding** - Make installation and first use as frictionless as possible
2. **More engaging** - Use visuals and compelling presentation to attract users
3. **Clearer structure** - Organize information hierarchically with user needs first
4. **Complete reference** - Ensure all necessary information is present and accessible

## Target Audience

**Primary:** General Netflix users (non-technical)  
**Secondary:** Technically inclined users who want to understand features  
**Tertiary:** Developers who may contribute

## Current State Analysis

The existing README.md (173 lines) contains:

- Good feature coverage
- All platform installation methods
- Configuration documentation
- Developer information
- Privacy policy and license

**Issues identified:**

- User onboarding could be more prominent
- Visual hierarchy could be improved
- Developer content mixed with user content
- Installation methods not prioritized by user preference
- No screenshots or visual aids

## Design Decisions

### 1. Structure Order

The README will follow this order, prioritizing user onboarding:

1. **Hero Section** - Project name, tagline, version badge, license badge
2. **Screenshot Gallery** - Visual proof of functionality
3. **Installation** - Platform-specific with store badges
4. **Features** - Benefit-focused bullet points
5. **Configuration** - All settings with user-facing labels
6. **Troubleshooting** - FAQ format
7. **Development** - Basic build info only
8. **Footer** - Privacy, License, links to other docs

### 2. Installation Section

**Decision:** Lead with store badge links, remove manual load instructions

- Chrome: Chrome Web Store badge link
- Firefox: Firefox Add-ons badge link
- Userscript: Userscript badge link + note about required manager

**Rationale:** Store installations provide the best user experience; manual loading is for developers and belongs in CONTRIBUTING.md

**Badge formats:**

```markdown
[![Install for Chrome](https://img.shields.io/badge/Chrome-Install-black?logo=googlechrome&logoColor=white)](store-url)
[![Install for Firefox](https://img.shields.io/badge/Firefox-Install-orange?logo=firefox&logoColor=white)](store-url)
[![Install Userscript](https://img.shields.io/badge/Userscript-Install-green?logo=tampermonkey&logoColor=white)](script-url)
```

### 3. Visual Elements

**Screenshots required:**

- `screenshots/hero.png` - Main hero image showing rating badges on Netflix thumbnails
- `screenshots/thumbnails.png` - Rating badges on browse grid thumbnails
- `screenshots/hover.png` - Hover card with ratings visible
- `screenshots/modal.png` - Preview modal with ratings

**Badges in hero:**

- License: GPLv3 (blue)
- Version: 1.3.0 (green)

### 4. Configuration Section

**Decision:** Organize settings into logical groups with user-facing default labels

**Groups:**

- Display Options (position, ratings to show, fade settings)
- API & Data (provider, API keys, cache settings)
- Advanced (debug mode)

**Default values use labels, not internal values:**

- `top-left` → `Top Left`
- `false` → `No`
- `true` → `Yes`
- `agregarr` → `Agregarr`
- `-1` → `Forever`

**All settings included:** Every configurable option from config-fields.js will be documented

### 5. Content to Remove from README

The following will be removed from README and documented in CONTRIBUTING.md:

- Detailed build instructions (rollup config, packaging)
- Testing commands and coverage info
- Development workflow details
- Architecture deep dive
- Rate limits and constants explanations
- Git hooks information

**README keeps only:**

```markdown
npm install
npm run build
```

### 6. Tone and Language

- **Non-technical:** Avoid jargon; explain features in user benefits
- **Concise:** Bullet points over paragraphs where possible
- **Action-oriented:** Start sentences with verbs where appropriate
- **Friendly:** Approachable language for general users

## File Changes

### Modified Files

1. `README.md` - Complete rewrite with new structure and content

### New Files

1. `screenshots/hero.png` - Main hero screenshot
2. `screenshots/thumbnails.png` - Thumbnail grid screenshot
3. `screenshots/hover.png` - Hover card screenshot
4. `screenshots/modal.png` - Preview modal screenshot

### Files to Update (Optional)

1. `CONTRIBUTING.md` - May need updates if developer info is moved from README

## Implementation Notes

### Screenshot Creation

Screenshots should be:

- High quality (retina-friendly)
- Show real Netflix UI with FlixMonkey overlays
- Anonymized (no personal recommendations visible)
- Consistent style across all images

### Badge URLs

All badge URLs should use the official shields.io service with consistent styling

### Link Validation

All external links must be validated:

- Chrome Web Store URL
- Firefox Add-ons URL
- Tampermonkey store URLs (Chrome and Firefox)
- Violentmonkey URL
- OMDB API key URL
- XMDB API key URL
- GitHub issues URL

## Success Criteria

The new README will be considered successful if:

1. **User onboarding time** decreases (fewer clicks to install)
2. **GitHub stars/conversions** increase (more engaging presentation)
3. **Issue reduction** - users can self-service via troubleshooting section
4. **Developer feedback** - contributors find the split between README and CONTRIBUTING clear
5. **All information** from current README is either preserved or intentionally removed

## Open Questions

None identified at this time.

## Approval

- [ ] User approved design
- [ ] Spec self-review completed
- [ ] Ready for implementation planning
