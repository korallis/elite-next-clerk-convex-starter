
Based on your original prompt and current best practices for AI-assisted UI generation, production-ready SaaS design, and Next.js 15 development, here's a significantly enhanced version that will help an AI agent deliver a highly polished, professional-grade frontend:

***

## 🎯 Project Brief: Leo Analytics UI Transformation

**Objective:** Transform Leo Analytics from a demo-heavy prototype into a production-grade SaaS analytics platform with a sophisticated purple-branded design system, pixel-perfect dark/light modes, and only features that are fully implemented.

**Quality Standard:** High-end SaaS product comparable to Linear, Notion, or Amplitude in visual polish and user experience.[^1][^2][^3]

***

## 📋 Context \& Constraints

### Technical Foundation

- **Framework:** Next.js 15 App Router (TypeScript, strict mode)
- **Styling:** TailwindCSS v4 + CSS variables, shadcn/ui "new-york" style
- **Theme System:** next-themes with `attribute="class"` via `components/theme-provider.tsx`
- **Icons:** lucide-react exclusively
- **Auth:** Clerk (fully integrated, do not modify)
- **Database:** Convex (hooks and providers intact)
- **Global Tokens:** `app/globals.css` (only file to modify for design tokens)
- **UI Components:** `components/ui/*` (shadcn primitives)
- **Path Aliases:** Per `components.json` configuration


### Hard Constraints (DO NOT VIOLATE)

1. **Zero Route Changes:** Maintain exact file structure under `app/**` including dynamic routes like `app/dashboards/[id]`
2. **Preserve Business Logic:** No changes to `app/api/**`, Convex functions, server actions, or data fetching patterns
3. **Maintain TypeScript Integrity:** Keep all prop types, interfaces, and component boundaries (`"use client"` placement)
4. **Provider Stability:** `app/layout.tsx` providers (`ClerkProvider`, `ConvexClientProvider`, `ThemeProvider`) must remain functional
5. **No New Dependencies:** Use only Tailwind, shadcn/ui, and lucide-react
6. **Component Contract Preservation:** All component APIs, props, and exports unchanged

***

## 🎨 Brand \& Design System

### Visual Identity: "Leo Analytics"

**Brand Personality:** Sophisticated, data-driven, trustworthy, modern[^2][^1]

**Core Principles:**

- **Minimalism:** Clean layouts, strategic white space, information hierarchy[^4][^2]
- **Clarity:** High contrast, WCAG AA compliant (4.5:1 for text, 3:1 for UI elements)[^5][^6]
- **Professionalism:** Subtle micro-interactions, refined shadows, consistent radius
- **Data Focus:** Purple accents highlight insights without overwhelming analytics


### Purple-First Color Strategy

**Light Mode:**

```css
--primary: 124 58 237 (violet-600 #7C3AED)
--primary-foreground: 255 255 255
--accent: 139 92 246 (violet-500 #8B5CF6)
--accent-foreground: 11 11 16
--ring: 167 139 250 (violet-300 #A78BFA)
--border: 229 231 235 (gray-200)
--input: 229 231 235
--card: 255 255 255
--card-foreground: 11 11 16
--popover: 255 255 255
--popover-foreground: 11 11 16
--secondary: 243 244 246 (gray-100)
--secondary-foreground: 11 11 16
--muted: 243 244 246
--muted-foreground: 107 114 128 (gray-500)
--destructive: 239 68 68 (red-500)
--destructive-foreground: 255 255 255
--background: 255 255 255
--foreground: 11 11 16
--radius: 0.5rem

/* Chart Palette (purple-forward, data visualization optimized) */
--chart-1: 139 92 246 (violet-500)
--chart-2: 167 139 250 (violet-300)
--chart-3: 196 181 253 (violet-200)
--chart-4: 109 40 217 (violet-700)
--chart-5: 124 58 237 (violet-600)
```

**Dark Mode:**

```css
--primary: 196 181 253 (violet-300 #C4B5FD)
--primary-foreground: 11 11 16
--accent: 167 139 250 (violet-400 #A78BFA)
--accent-foreground: 11 11 16
--ring: 139 92 246 (violet-500)
--border: rgba(255 255 255 / 0.12)
--input: rgba(255 255 255 / 0.15)
--card: 17 17 26 (#11111A)
--card-foreground: 250 250 250
--popover: 17 17 26
--popover-foreground: 250 250 250
--secondary: 30 30 46 (gray-900)
--secondary-foreground: 250 250 250
--muted: 30 30 46
--muted-foreground: 161 161 170 (gray-400)
--destructive: 239 68 68
--destructive-foreground: 255 255 255
--background: 11 11 16 (#0B0B10)
--foreground: 250 250 250
--radius: 0.5rem

/* Chart Palette (adjusted for dark mode visibility) */
--chart-1: 196 181 253 (violet-300)
--chart-2: 167 139 250 (violet-400)
--chart-3: 139 92 246 (violet-500)
--chart-4: 221 214 254 (violet-200)
--chart-5: 124 58 237 (violet-600)
```

**Contrast Validation:** All color combinations must pass WCAG 2.1 AA standards. Test at shadcnstudio.com/theme-generator or use `contrast-color()` function where supported.[^7][^6][^5]

***

## 🏗️ Design Patterns \& Components

### Global UI Standards

**Typography:**

- Headings: Bold, clear hierarchy (use existing Tailwind classes)
- Body: 16px base, 1.5 line-height for readability
- Code/Data: Monospace where appropriate

**Spacing \& Layout:**

- Consistent padding: 16px (mobile), 24px (tablet), 32px (desktop)
- Card spacing: 16px internal padding, 8px-16px between cards
- Section gaps: 48px-64px vertical rhythm

**Interactive States:**

- Hover: Subtle background shift + purple accent hint
- Focus: Visible `--ring` outline (2px, purple)
- Active: Deeper purple tone + slight scale (0.98)
- Disabled: 50% opacity, no pointer events

**Micro-Interactions:**

- Smooth transitions: `transition-all duration-200 ease-in-out`
- Button ripples: Subtle, not distracting
- Loading states: Skeleton screens (purple accent) + spinner where appropriate[^4][^2]


### Shadcn Component Updates

**Update these primitives to use new tokens (maintain all APIs):**

- `button.tsx`: Primary variant = purple, ghost/outline variants follow accent
- `input.tsx`, `select.tsx`, `textarea.tsx`: Border uses `--border`, focus uses `--ring`
- `card.tsx`: Background `--card`, subtle shadow
- `table.tsx`: Striped rows in dark mode, purple headers
- `tabs.tsx`: Active tab = purple underline/background
- `badge.tsx`: Purple for "active" states
- `sidebar.tsx`: Selected item = purple accent background + icon
- `dropdown-menu.tsx`, `sheet.tsx`, `tooltip.tsx`: Consistent surface colors
- `switch.tsx`, `toggle.tsx`: Purple when active
- `separator.tsx`: Uses `--border`
- `skeleton.tsx`: Purple-tinted shimmer
- `avatar.tsx`: Fallback with purple background

**ModeToggle (`components/mode-toggle.tsx`):**

- Sun icon (light mode) and moon icon (dark mode) with smooth rotation
- Button follows accent color scheme

***

## 📄 Page-by-Page Transformation

### Landing Pages (`app/(landing)/*`)

**Goals:** Convert generic marketing site to Leo Analytics-branded showcase[^8][^3]

**Components to Update:**

- `header.tsx`: Leo Analytics logo/wordmark, purple CTA button ("Get Started")
- `hero-section.tsx`: Bold headline, purple gradient on accent text, modern dashboard screenshot (if available) or illustration placeholder
- `features-one.tsx`: 3-column grid, lucide icons with purple accent, clean cards
- `table.tsx`: Pricing/comparison table with purple highlights for recommended plan
- `testimonials.tsx`: Soft purple accent on quotes, professional avatar styling
- `faqs.tsx`: Accordion with purple expand icons
- `call-to-action.tsx`: Purple gradient button, high contrast on dark section
- `footer.tsx`: Minimal, organized links, Leo Analytics branding

**Remove:** All demo content placeholders, generic "SaaS Template" references

***

### Authentication (`app/(auth)/*`)

**Pages:** `sign-in`, `sign-up`

**Design:**

- Centered card layout, max-width 400px
- Leo Analytics logo at top
- Clerk components styled via CSS variables (purple accent on buttons/links)
- Minimal distractions, high contrast form fields
- Dark mode: card on `--card` background with subtle border

***

### Onboarding (`app/onboarding/*`)

**Design:**

- Multi-step wizard with purple progress bar
- Step indicators (circles) with purple fill for completed steps
- Clear headings per step ("Welcome to Leo Analytics", "Connect Your Data", etc.)
- Primary CTAs in purple, secondary as ghost buttons
- Skip/back navigation in muted color

**Remove:** Any onboarding steps for features NOT implemented

***

### Dashboard Shell (`app/dashboard/*`)

**Core Layout (`layout.tsx`):**

- **Sidebar (`app-sidebar.tsx`, `nav-main.tsx`, `nav-secondary.tsx`, `nav-user.tsx`, `nav-workspace.tsx`):**
    - Fixed left sidebar, collapsible on mobile
    - Selected nav item: purple accent background (10% opacity) + icon color
    - Hover states: subtle purple hint
    - User avatar at bottom with purple ring
    - Workspace switcher with purple active state
- **Top Bar (`site-header.tsx`):**
    - Leo Analytics logo/text (left)
    - Search bar (center, if applicable) with purple focus ring
    - User menu + ModeToggle (right)
    - Breadcrumbs for navigation context (purple separators)

**Dashboard Home (`page.tsx`):**

- Hero metrics cards (4-column grid on desktop): KPIs with purple accent icons, subtle shadows
- Recent activity table: Purple headers, hover states on rows
- Charts (`chart-area-interactive.tsx`): Use `--chart-*` tokens, purple legends
- Empty states: Friendly illustration + purple CTA button ("Connect Data Source")

**Loading States (`loading-bar.tsx`):**

- Purple progress bar at top of viewport
- Skeleton screens with purple shimmer

**Data Table (`data-table.tsx`):**

- Sticky headers (purple on scroll)
- Sortable columns with purple sort icons
- Pagination controls with purple active page
- Row actions (dropdown) with purple hover

***

### Feature Pages (Only Include If Implemented)

#### Ask/Chat UI (`app/dashboard/ask/*`)

- Chat bubbles: User messages = purple accent border, assistant = neutral
- Input field: Large, purple focus ring, send button = purple
- Loading dots: Purple animation
- Suggestions: Purple chip buttons


#### Auto Dashboard (`app/dashboard/auto-dashboard/*`)

- Dashboard generation flow: Step-by-step cards with purple progress
- Generated dashboard preview: Purple accents on key metrics
- Edit/save actions: Purple primary buttons


#### Connections (`app/dashboard/connections/*`, `connections/new/*`)

- Connection cards: Logo + status badge (green = connected, purple = active)
- New connection wizard: Multi-step form with purple progress bar
- OAuth buttons: Purple accent on hover
- Validation errors: Red, but maintain purple focus rings


#### Data Map (`app/dashboard/data-map/*`, `app/data-map/page.tsx`)

- Table view: Purple headers, filterable columns
- Search/filter bar: Purple active filters
- Entity relationships: Purple connection lines (if visual graph)


#### Audit Log (`app/dashboard/audit/page.tsx`)

- Timeline view: Purple event markers
- Expandable rows: Purple expand icon
- Filter chips: Purple active state


#### Stakeholder Metrics (`app/dashboard/stakeholder-metrics/*`)

- Metric cards: Purple icons, trend arrows
- Comparison charts: Purple for primary data series

***

### Dynamic Dashboards (`app/dashboards/*`)

**Dashboard List (`page.tsx`):**

- Grid of dashboard cards: Thumbnail + title + last updated
- Hover: Purple border + shadow lift
- Create new button: Large, purple, prominent

**Dashboard Detail (`app/dashboards/[id]/*`):**

- **`ChartRenderer` / `AnalyticsDashboard`:**
    - **Critical:** Preserve all data-binding logic and component contracts
    - Update only visual styling:
        - Chart colors: Use `--chart-1` through `--chart-5` for series
        - Legend: Purple selected state
        - Tooltips: Purple accent on data point hover
        - Grid lines: `--border` color
        - Axis labels: `--muted-foreground`
    - Responsive: Stack charts on mobile, grid on desktop
    - Empty state: Purple icon + "No data yet" message

**Dashboard Actions:**

- Edit/delete buttons: Purple primary, red destructive
- Share modal: Purple share button, clean input fields

***

## ♿ Accessibility \& Performance

**WCAG 2.1 AA Compliance:**

- Text contrast: 4.5:1 minimum
- UI elements: 3:1 minimum
- Focus indicators: Always visible, 2px purple ring
- Keyboard navigation: Logical tab order, skip links
- Screen reader: ARIA labels on all interactive elements, semantic HTML

**Performance Targets:**

- First Contentful Paint: <1.5s
- Time to Interactive: <3s
- Lighthouse Score: 90+ (Performance, Accessibility, Best Practices)
- No layout shifts (CLS < 0.1)

**Optimization:**

- Lazy load images and charts below fold
- Use Next.js `<Image>` component with `priority` for hero images
- Minimize CSS specificity, leverage Tailwind utility classes
- No inline styles except for dynamic gradients

***

## 🚀 Implementation Strategy

### Phase 1: Foundation (Do This First)

1. Update `app/globals.css` with new light/dark tokens
2. Test tokens across one sample page to validate contrast/consistency
3. Update shadcn primitives in `components/ui/*` (button, input, card first)
4. Verify ModeToggle works perfectly

### Phase 2: Core Shell

1. Restyle dashboard layout (`app/dashboard/layout.tsx`)
2. Update sidebar components (nav-main, app-sidebar, etc.)
3. Update site-header
4. Verify navigation states (active, hover, focus)

### Phase 3: Content Pages

1. Landing pages (header → hero → features → footer)
2. Auth pages
3. Dashboard home page
4. Feature pages (one at a time, testing each)

### Phase 4: Data Visualization

1. Update chart components with new palette
2. Test all chart types (area, bar, line, pie)
3. Verify legends and tooltips
4. Check dark mode visibility

### Phase 5: Polish \& QA

1. Responsive testing (mobile, tablet, desktop)
2. Dark/light mode switching across all pages
3. Accessibility audit (keyboard nav, screen reader)
4. Performance audit (Lighthouse)
5. Remove ALL remaining demo content/placeholder text

***

## ✅ Acceptance Criteria

### Functional

- [ ] `npm run build` succeeds with zero TypeScript errors
- [ ] `npm run lint` passes with no warnings
- [ ] All existing tests pass
- [ ] No broken routes or 404s
- [ ] Clerk auth flow works identically
- [ ] Convex data fetching unchanged
- [ ] Dark/light mode toggle works on every page


### Visual

- [ ] Purple brand accent consistent across all pages
- [ ] No demo content or generic "SaaS" references remain
- [ ] Only implemented features are visible in UI
- [ ] All text meets WCAG AA contrast (verify with WebAIM checker)
- [ ] Hover/focus/active states consistent
- [ ] Smooth transitions, no janky animations
- [ ] Responsive on 320px, 768px, 1024px, 1440px+ viewports


### Professional Polish

- [ ] Looks comparable to Linear/Notion/Amplitude in quality[^3][^1]
- [ ] Charts are legible and visually appealing in both modes
- [ ] Loading states (skeletons, spinners) are polished
- [ ] Empty states are friendly and actionable
- [ ] Error states are clear and non-technical
- [ ] Micro-interactions feel smooth, not distracting

***

## 📦 Deliverables

1. **`app/globals.css`:** Updated with Leo Analytics purple-forward light/dark tokens
2. **`components/ui/*`:** All shadcn primitives restyled (no API changes)
3. **Landing pages:** Rebranded to Leo Analytics, demo content removed
4. **Auth pages:** Minimal, branded forms
5. **Onboarding flow:** Modern wizard with purple accents
6. **Dashboard shell:** Sidebar + topbar with purple navigation states
7. **Dashboard home:** Polished cards, tables, charts
8. **Feature pages:** Only pages for implemented features, styled consistently
9. **Dynamic dashboards:** Chart colors updated, logic preserved
10. **ModeToggle:** Styled to match brand
11. **Documentation:** Brief changelog/style guide (optional but recommended)

***

## 🎯 Pro Tips for AI Agent

**Context is King:**

- Review existing component structure before making changes[^9][^10]
- Understand the distinction between server and client components[^11][^12]
- Preserve all imports/exports exactly as they are

**Iterative Refinement:**

- Start with one page/component to establish pattern
- Apply pattern consistently across similar components[^9]
- Test dark mode immediately after each light mode update

**Leverage Shadcn Patterns:**

- Use existing shadcn component APIs (don't reinvent)[^13][^14]
- Copy successful color token patterns from shadcn violet theme[^13]
- Maintain "new-york" style conventions (rounded corners, subtle shadows)

**Quality Checks:**

- After each page, verify: Does this look like a \$50k+ SaaS product?[^1][^2]
- Would I pay for this? Does it inspire confidence?
- Can a colorblind user navigate this?

**Performance:**

- Keep Tailwind classes, avoid heavy custom CSS[^15][^16]
- Use CSS variables for all colors (faster theme switching)
- Lazy load heavy components (charts, images)

***

## 📚 Reference Examples (Visual Inspiration)

- **Linear:** Clean sidebar, purple accents, minimal dashboard[^3]
- **Notion:** Flexible layouts, soft colors, great empty states[^3]
- **Amplitude:** Data-forward, professional charts, purple brand[^8][^1]
- **Stripe Dashboard:** High contrast, clear hierarchy, polished interactions
- **Vercel Dashboard:** Modern dark mode, subtle animations, purple accents

***

## 🔗 Validation Resources

- **Contrast Checker:** webaim.org/resources/contrastchecker
- **Shadcn Theme Generator:** shadcnstudio.com/theme-generator[^7]
- **Tailwind Color Palette:** tailwindcss.com/docs/customizing-colors
- **WCAG Guidelines:** w3.org/WAI/WCAG21/quickref
- **Lighthouse CI:** web.dev/measure

***

**END OF PROMPT**

This enhanced prompt provides the AI agent with comprehensive context, clear constraints, specific color values with WCAG compliance considerations, detailed page-by-page instructions, accessibility requirements, and a phased implementation strategy. It emphasizes production quality while preserving your existing technical infrastructure.[^17][^6][^16][^10][^2][^5][^1][^13][^7][^9][^8][^3]
<span style="display:none">[^18][^19][^20][^21][^22][^23][^24][^25][^26][^27][^28][^29][^30][^31][^32][^33][^34][^35][^36][^37][^38][^39][^40][^41][^42][^43][^44]</span>

<div align="center">⁂</div>

[^1]: https://www.orbix.studio/blogs/top-saas-product-design-trends-2025

[^2]: https://www.thealien.design/insights/saas-ui-design

[^3]: https://procreator.design/blog/saas-dashboards-that-nail-user-onboarding/

[^4]: https://upstackstudio.com/blog/user-interface-design-principles/

[^5]: https://css-tricks.com/almanac/functions/l/light-dark/

[^6]: https://bitskingdom.com/blog/dark-mode-issues-fix-with-css/

[^7]: https://shadcnstudio.com/theme-generator

[^8]: https://productled.com/blog/how-to-create-a-value-based-saas-dashboard-design

[^9]: https://flexxited.com/blog/v0-dev-guide-2025-ai-powered-ui-generation-for-react-and-tailwind-css

[^10]: https://harveyducay.blog/most-common-mistakes-in-using-v0

[^11]: https://leapcell.io/blog/navigating-next-js-app-router-and-pages-router-evolution

[^12]: https://nextjs.org/docs/app/guides/migrating/app-router-migration

[^13]: https://www.shadcn.io/theme/violet

[^14]: https://github.com/Railly/shadcn-ui-customizer

[^15]: https://varbintech.com/blog/ui-component-libraries-5-must-try-picks-for-next-js-in-2025

[^16]: https://dev.to/hitesh_developer/using-shadcn-in-a-production-ready-nextjs-application-2g97

[^17]: https://www.reddit.com/r/reactjs/comments/1gvmi3l/my_endless_cycle_of_building_and_rebuilding_my/

[^18]: https://stackoverflow.com/questions/62989878/how-can-i-prevent-force-dark-mode-by-the-system

[^19]: https://github.com/continuedev/continue/issues/3803

[^20]: https://www.elegantthemes.com/blog/divi-resources/rebranding-a-website-in-5-minutes-with-extend-attributes

[^21]: https://forum.bricksbuilder.io/t/frontend-looks-different-in-frontend/942

[^22]: https://www.bootstrapdash.com/product/purple-bootstrap-admin-template

[^23]: https://theme.co/forum/t/different-content-in-front-end-and-back-end/109124

[^24]: https://colorffy.com/dark-theme-generator

[^25]: https://www.weweb.io/blog/ui-design-principles

[^26]: https://github.com/shadcn-ui/ui/issues/313

[^27]: https://userpilot.com/blog/saas-ux-design/

[^28]: https://www.bootstrapdash.com/product/purple-free-admin-template

[^29]: https://www.technbrains.com/blog/web-app-design/

[^30]: https://theme.co/forum/t/some-pages-page-content-not-showing-in-frontend-after-update/85754

[^31]: https://www.designstudiouiux.com/blog/top-saas-design-trends/

[^32]: https://www.behance.net/search/projects/dark mode dashboard

[^33]: https://www.justinmind.com/ui-design/principles

[^34]: https://www.inngest.com/blog/5-lessons-learned-from-taking-next-js-app-router-to-production

[^35]: https://css-tricks.com/exploring-the-css-contrast-color-function-a-second-time/

[^36]: https://vercel.com/blog/common-mistakes-with-the-next-js-app-router-and-how-to-fix-them

[^37]: https://tweakcn.com

[^38]: https://ruttl.com/blog/dark-mode-design/

[^39]: https://www.reddit.com/r/nextjs/comments/1jgbvx7/a_stepbystep_guide_to_v0dev_development/

[^40]: https://saaspo.com/industry/leo-saas-websites-inspiration

[^41]: https://www.reddit.com/r/nextjs/comments/1jp27yn/buildit_productionready_nextjs_15_boilerplate/

[^42]: https://vercel.com/blog/maximizing-outputs-with-v0-from-ui-generation-to-code-creation

[^43]: https://www.youtube.com/watch?v=SGyMYG6C91M

[^44]: https://dev.to/isanjayjoshi/top-nextjs-shadcn-ui-templates-for-websites-and-admin-dashboards-6m6

