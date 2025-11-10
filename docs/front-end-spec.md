# NDC Packaging & Quantity Calculator — Front-End Specification

> **Designer**: Sally (UX Expert)  
> **Version**: 1.0  
> **Date**: 2024  
> **Based on**: PRD v0.1

---

## 1) Design Philosophy

**Core Principles:**
- **Clarity First**: Pharmacists and techs need immediate, unambiguous results
- **Trust Through Transparency**: Show all relevant data, flags, and alternates clearly
- **Efficiency**: Minimize clicks, maximize information density without clutter
- **Accessibility**: WCAG 2.1 Level AA compliance is non-negotiable
- **Modern Aesthetic**: Clean, professional, healthcare-appropriate design

**Design System:**
- **Style**: Minimalist, data-forward interface with subtle depth
- **Color Palette**: Professional healthcare blue/gray with clear status indicators
- **Typography**: Clear hierarchy with excellent readability
- **Interactions**: Subtle animations that provide feedback without distraction

---

## 2) Visual Design System

### 2.1 Color Palette

```css
/* Primary Colors */
--primary-50: #EFF6FF;
--primary-100: #DBEAFE;
--primary-500: #3B82F6;  /* Primary action blue */
--primary-600: #2563EB;
--primary-700: #1D4ED8;

/* Neutral Colors */
--gray-50: #F9FAFB;
--gray-100: #F3F4F6;
--gray-200: #E5E7EB;
--gray-300: #D1D5DB;
--gray-400: #9CA3AF;
--gray-500: #6B7280;
--gray-600: #4B5563;
--gray-700: #374151;
--gray-900: #111827;

/* Status Colors */
--success-500: #10B981;  /* Exact match, active NDC */
--warning-500: #F59E0B;  /* Overfill, inactive NDC warning */
--error-500: #EF4444;    /* Mismatch, error states */
--info-500: #06B6D4;     /* Conversion notes, info */

/* Background */
--bg-primary: #FFFFFF;
--bg-secondary: #F9FAFB;
--bg-elevated: #FFFFFF;
--bg-overlay: rgba(0, 0, 0, 0.5);

/* Text */
--text-primary: #111827;
--text-secondary: #6B7280;
--text-tertiary: #9CA3AF;
```

### 2.2 Typography

```css
/* Font Stack */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 
             'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 
             'Helvetica Neue', sans-serif;

/* Scale */
--text-xs: 0.75rem;    /* 12px - Labels, captions */
--text-sm: 0.875rem;   /* 14px - Secondary text */
--text-base: 1rem;     /* 16px - Body text */
--text-lg: 1.125rem;   /* 18px - Emphasized text */
--text-xl: 1.25rem;    /* 20px - Section headers */
--text-2xl: 1.5rem;    /* 24px - Card titles */
--text-3xl: 1.875rem;  /* 30px - Results display */
--text-4xl: 2.25rem;   /* 36px - Primary quantity */
--text-5xl: 3rem;      /* 48px - Hero numbers */

/* Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### 2.3 Spacing & Layout

```css
/* Spacing Scale (8px base) */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */

/* Layout */
--container-max-width: 1200px;
--content-max-width: 800px;
--border-radius-sm: 0.375rem;   /* 6px */
--border-radius-md: 0.5rem;     /* 8px */
--border-radius-lg: 0.75rem;    /* 12px */
--border-radius-xl: 1rem;       /* 16px */

/* Shadows */
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
```

### 2.4 Components & Patterns

**Card Component:**
- White background (`--bg-elevated`)
- Rounded corners (`--border-radius-lg`)
- Subtle shadow (`--shadow-md`)
- Padding: `--space-6`
- Hover: Shadow elevation (`--shadow-lg`)

**Button Styles:**
- **Primary**: Blue background (`--primary-500`), white text, hover `--primary-600`
- **Secondary**: Gray border, transparent background, hover gray fill
- **Ghost**: No border, text only, hover background
- **Danger**: Red variant for destructive actions
- Height: 44px (touch-friendly)
- Padding: `--space-3` `--space-6`
- Border radius: `--border-radius-md`

**Input Fields:**
- Height: 44px
- Border: 1px solid `--gray-300`
- Border radius: `--border-radius-md`
- Padding: `--space-3` `--space-4`
- Focus: 2px solid `--primary-500` outline
- Error: Red border (`--error-500`)

**Badge/Tag:**
- Small rounded pill
- Background color by status
- Text: `--text-xs`, `--font-medium`
- Padding: `--space-1` `--space-2`

---

## 3) Page Layout & Structure

### 3.1 Overall Layout

```
┌─────────────────────────────────────────────────────────┐
│                    Header (Sticky)                       │
│  Logo | Title | [Minimal nav if needed]                 │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────────────────────────────────┐      │
│  │         Main Content Container                 │      │
│  │  (max-width: 800px, centered)                  │      │
│  │                                                 │      │
│  │  ┌──────────────────────────────────────┐     │      │
│  │  │      Input Form Card                  │     │      │
│  │  │  - Drug Input                         │     │      │
│  │  │  - SIG                                │     │      │
│  │  │  - Days Supply                        │     │      │
│  │  │  - [Advanced Options] (Collapsible)   │     │      │
│  │  │  - [Calculate Button]                 │     │      │
│  │  └──────────────────────────────────────┘     │      │
│  │                                                 │      │
│  │  ┌──────────────────────────────────────┐     │      │
│  │  │      Results Card                     │     │      │
│  │  │  - Quantity Display (Large)           │     │      │
│  │  │  - Chosen NDC                         │     │      │
│  │  │  - Package Details                    │     │      │
│  │  │  - Flags & Warnings                   │     │      │
│  │  │  - Alternates List (Collapsible)      │     │      │
│  │  │  - [Copy JSON Button]                 │     │      │
│  │  └──────────────────────────────────────┘     │      │
│  │                                                 │      │
│  └──────────────────────────────────────────────┘      │
│                                                           │
│                    Footer (Minimal)                       │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Responsive Breakpoints

```css
/* Mobile First */
--breakpoint-sm: 640px;   /* Small tablets */
--breakpoint-md: 768px;   /* Tablets */
--breakpoint-lg: 1024px;  /* Desktop */
--breakpoint-xl: 1280px;  /* Large desktop */

/* Mobile (< 640px) */
- Single column layout
- Full-width cards
- Stacked form fields
- Touch-optimized targets (44px min)

/* Tablet (640px - 1024px) */
- Slightly wider cards
- Two-column form layout (if space allows)
- Maintain touch targets

/* Desktop (≥ 1024px) */
- Centered content (max-width: 800px)
- Hover states active
- Keyboard navigation optimized
```

---

## 4) Component Specifications

### 4.1 Header

**Purpose**: Branding and navigation anchor

**Specifications:**
- **Height**: 64px
- **Background**: `--bg-primary` with subtle border-bottom
- **Content**: 
  - Left: Logo/Icon + "NDC Quantity Calculator"
  - Right: (Optional) Settings/Help icon
- **Sticky**: Yes, stays at top on scroll
- **Z-index**: 100

**Accessibility:**
- Semantic `<header>` element
- Skip to main content link (visually hidden, keyboard accessible)

---

### 4.2 Input Form Card

**Purpose**: Primary user input interface

**Layout:**
```
┌────────────────────────────────────────────┐
│  Calculate Quantity                        │
│  ────────────────────────────────────────  │
│                                             │
│  Drug Name or NDC *                        │
│  ┌─────────────────────────────────────┐  │
│  │ [Text Input]                        │  │
│  │ Placeholder: "e.g., amoxicillin..." │  │
│  └─────────────────────────────────────┘  │
│                                             │
│  SIG (Directions) *                        │
│  ┌─────────────────────────────────────┐  │
│  │ [Text Input]                        │  │
│  │ Placeholder: "e.g., 1 cap PO BID"   │  │
│  └─────────────────────────────────────┘  │
│                                             │
│  Days Supply *                             │
│  ┌─────────────────────────────────────┐  │
│  │ [Number Input]                      │  │
│  │ Placeholder: "30"                   │  │
│  └─────────────────────────────────────┘  │
│                                             │
│  ┌─────────────────────────────────────┐  │
│  │  ▼ Advanced Options                 │  │
│  └─────────────────────────────────────┘  │
│  (Collapsed by default)                    │
│                                             │
│  ┌─────────────────────────────────────┐  │
│  │      [Calculate]                    │  │
│  └─────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

**Form Fields:**

1. **Drug Name or NDC**
   - Type: `text`
   - Label: "Drug Name or NDC" (required asterisk)
   - Placeholder: "e.g., amoxicillin 500 mg cap or 00000-1111-22"
   - Validation: Required, min 2 characters
   - Error message: "Please enter a drug name or NDC"

2. **SIG (Directions)**
   - Type: `text`
   - Label: "SIG (Directions)" (required asterisk)
   - Placeholder: "e.g., 1 cap PO BID"
   - Validation: Required, min 3 characters
   - Error message: "Please enter prescription directions"
   - Helper text: "Enter the prescription directions as written"

3. **Days Supply**
   - Type: `number`
   - Label: "Days Supply" (required asterisk)
   - Placeholder: "30"
   - Validation: Required, min 1, max 365
   - Error message: "Please enter a valid days supply (1-365)"

**Advanced Options (Collapsible):**

- **Trigger**: Accordion-style button with chevron icon
- **State**: Collapsed by default
- **Animation**: Smooth height transition (300ms ease)
- **Content**:
  - Preferred NDCs (comma-separated text input)
  - Quantity Unit Override (dropdown: tab, cap, mL, actuation, unit)
  - Max Overfill % (number input, default: 10)

**Calculate Button:**
- **Style**: Primary button, full-width on mobile
- **State**: 
  - Default: Enabled
  - Loading: Spinner + "Calculating..."
  - Disabled: When form invalid
- **Icon**: (Optional) Calculator icon on left

**Accessibility:**
- All inputs have associated `<label>` elements
- Required fields marked with `aria-required="true"`
- Error messages linked via `aria-describedby`
- Form validation announced to screen readers
- Submit button has `aria-label` when loading

---

### 4.3 Results Card

**Purpose**: Display computed results and package selection

**Layout:**
```
┌────────────────────────────────────────────┐
│  Results                                   │
│  ────────────────────────────────────────  │
│                                             │
│         ┌──────────────┐                   │
│         │     60       │  ← Large quantity │
│         │   capsules   │                   │
│         └──────────────┘                   │
│                                             │
│  ┌─────────────────────────────────────┐  │
│  │  Selected Package                   │  │
│  │  ────────────────────────────────   │  │
│  │  NDC: 00000-1111-22  [Active] ✓    │  │
│  │  Package Size: 60                   │  │
│  │  Packs: 1                           │  │
│  │  Overfill: 0%                       │  │
│  └─────────────────────────────────────┘  │
│                                             │
│  ┌─────────────────────────────────────┐  │
│  │  ⚠️  Flags & Warnings               │  │
│  │  (Only shown if flags present)      │  │
│  └─────────────────────────────────────┘  │
│                                             │
│  ┌─────────────────────────────────────┐  │
│  │  ▼ Alternate Packages (2)           │  │
│  └─────────────────────────────────────┘  │
│  (Collapsible list)                        │
│                                             │
│  ┌─────────────────────────────────────┐  │
│  │  [Copy JSON Response]               │  │
│  └─────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

**Quantity Display:**
- **Size**: `--text-5xl` (48px) for number
- **Weight**: `--font-bold`
- **Color**: `--primary-600`
- **Unit**: `--text-2xl` (24px), `--text-secondary`
- **Layout**: Centered, prominent
- **Animation**: Fade-in + subtle scale (200ms)

**Selected Package Section:**
- **Background**: `--bg-secondary` (subtle gray)
- **Border**: 2px solid `--primary-500` (highlight)
- **Padding**: `--space-4`
- **Border Radius**: `--border-radius-md`
- **Content**:
  - NDC: Monospace font, copyable (click to copy)
  - Status badge: Green "Active" or Yellow "Inactive"
  - Package details: Grid layout (2 columns on desktop)
  - Overfill indicator: Color-coded (green = 0%, yellow = >0%, red = >10%)

**Flags & Warnings Section:**
- **Visibility**: Only shown when flags exist
- **Layout**: Vertical list of badges/messages
- **Types**:
  - **Inactive NDCs**: Yellow warning badge with list
  - **Mismatch**: Red error badge with message
  - **Conversion Notes**: Blue info badge with details
- **Icons**: Warning (⚠️), Error (❌), Info (ℹ️)

**Alternate Packages:**
- **Trigger**: Collapsible accordion
- **Default**: Collapsed
- **Count Badge**: Show number in header "(2)"
- **List Items**:
  - Each alternate in its own card
  - Same layout as selected package (smaller)
  - Hover: Subtle highlight
  - Click: (Future) Select as primary

**Copy JSON Button:**
- **Style**: Secondary button
- **Icon**: Copy icon
- **Behavior**: 
  - Click: Copy full JSON response to clipboard
  - Toast notification: "JSON copied to clipboard"
  - Visual feedback: Button state change (200ms)

**Empty State:**
- **Message**: "Enter drug information above and click Calculate"
- **Icon**: Calculator illustration (optional)
- **Style**: Centered, `--text-secondary`

**Loading State:**
- **Skeleton**: Animated placeholder cards
- **Message**: "Calculating quantity and package selection..."
- **Spinner**: Centered, primary color

**Error State:**
- **Message**: Clear error description
- **Error Code**: Monospace, `--text-tertiary`
- **Retry Button**: If applicable (424 errors)

**Accessibility:**
- Results announced to screen readers via `aria-live="polite"`
- Status badges have `aria-label` with full description
- Copy button has `aria-label="Copy JSON response to clipboard"`
- Collapsible sections have `aria-expanded` state
- Keyboard navigation: Tab through all interactive elements

---

### 4.4 Toast Notifications

**Purpose**: Provide non-intrusive feedback

**Specifications:**
- **Position**: Top-right (desktop), top-center (mobile)
- **Duration**: 3 seconds (auto-dismiss)
- **Types**:
  - Success: Green background
  - Warning: Yellow background
  - Error: Red background
  - Info: Blue background
- **Animation**: Slide-in from right, fade-out
- **Content**: Icon + message
- **Stacking**: Multiple toasts stack vertically
- **Dismiss**: X button (always visible)

**Accessibility:**
- `role="alert"` for important messages
- `aria-live="polite"` for non-critical
- Keyboard dismissible (Escape key)

---

### 4.5 Footer

**Purpose**: Minimal footer with essential info

**Content:**
- Version number
- (Optional) Links: Documentation, Support
- Copyright notice

**Style**: 
- Minimal padding
- `--text-tertiary`
- `--text-sm`

---

## 5) Interaction Design

### 5.1 Form Interactions

**Input Focus:**
- Clear focus ring (2px solid `--primary-500`)
- Smooth transition (150ms)
- Label color change to `--primary-600`

**Validation:**
- **Real-time**: On blur (not on every keystroke)
- **Visual**: Red border + error message below field
- **Accessibility**: Error announced to screen reader
- **Success**: Green checkmark icon (optional, subtle)

**Calculate Button:**
- **Hover**: Darker shade, slight elevation
- **Active**: Pressed state (scale 0.98)
- **Loading**: Spinner replaces text, button disabled
- **Success**: (Optional) Brief success animation

### 5.2 Results Interactions

**Quantity Display:**
- **Animation**: Fade-in + scale (0.95 → 1.0)
- **Duration**: 300ms ease-out

**Package Selection:**
- **Hover**: Subtle background color change
- **Selected**: Clear border highlight
- **Copy NDC**: Click to copy, toast notification

**Alternates Accordion:**
- **Expand/Collapse**: Smooth height transition (300ms)
- **Chevron**: Rotates 180° on expand
- **Keyboard**: Enter/Space to toggle

### 5.3 Micro-interactions

**Button Presses:**
- Scale: 0.98 (100ms)
- Return: 1.0 (100ms)

**Badge Hover:**
- Slight scale: 1.05
- Shadow elevation

**Card Hover:**
- Shadow: `--shadow-md` → `--shadow-lg`
- Transition: 200ms ease

**Loading States:**
- Spinner: Rotating animation (1s linear infinite)
- Skeleton: Shimmer effect (1.5s ease-in-out infinite)

---

## 6) Accessibility Specifications

### 6.1 Keyboard Navigation

**Tab Order:**
1. Skip to main content link (if present)
2. Drug input
3. SIG input
4. Days supply input
5. Advanced options toggle
6. Calculate button
7. Results section (if present)
8. Copy JSON button
9. Footer links

**Keyboard Shortcuts:**
- `Enter` in form: Submit (if valid)
- `Escape`: Close modals/toasts
- `Tab`: Navigate forward
- `Shift+Tab`: Navigate backward

**Focus Indicators:**
- **Visible**: 2px solid `--primary-500` outline
- **Offset**: 2px from element
- **Always**: Visible, never removed
- **Contrast**: Meets WCAG AA (3:1 minimum)

### 6.2 Screen Reader Support

**Semantic HTML:**
- `<form>` for input form
- `<main>` for primary content
- `<section>` for results
- `<article>` for package details
- `<button>` for all interactive elements
- `<label>` for all form inputs

**ARIA Labels:**
- All icons have `aria-label`
- Status badges: `aria-label="Status: Active"`
- Loading states: `aria-busy="true"`
- Results: `aria-live="polite"`
- Errors: `role="alert"`

**Form Labels:**
- All inputs have visible `<label>`
- Required fields: `aria-required="true"`
- Error messages: `aria-describedby` linking to error text

**Dynamic Content:**
- Results announced via `aria-live="polite"`
- Errors announced via `role="alert"`
- Status changes announced

### 6.3 Color Contrast

**Text Contrast:**
- Primary text: 4.5:1 minimum (WCAG AA)
- Secondary text: 4.5:1 minimum
- Large text (18px+): 3:1 minimum

**Interactive Elements:**
- Buttons: 3:1 contrast minimum
- Focus indicators: 3:1 contrast minimum
- Status badges: 3:1 contrast minimum

**Color Independence:**
- Never rely on color alone to convey information
- Icons + text for status indicators
- Patterns/textures for charts (if added later)

### 6.4 Responsive & Touch

**Touch Targets:**
- Minimum: 44×44px
- Spacing: 8px minimum between targets
- All buttons meet size requirement

**Mobile Optimizations:**
- Larger tap targets
- Full-width buttons on mobile
- Stacked form layout
- Bottom-aligned action buttons (if needed)

**Zoom Support:**
- Content remains usable at 200% zoom
- Text reflows appropriately
- No horizontal scrolling at 320px width

---

## 7) Responsive Design Details

### 7.1 Mobile (< 640px)

**Layout:**
- Single column
- Full-width cards (margin: `--space-4`)
- Stacked form fields
- Full-width buttons

**Typography:**
- Slightly larger base font (16px minimum)
- Reduced heading sizes

**Spacing:**
- Reduced padding in cards (`--space-4` instead of `--space-6`)
- Tighter vertical spacing

**Interactions:**
- Larger touch targets
- Swipe gestures for alternates (optional)

### 7.2 Tablet (640px - 1024px)

**Layout:**
- Slightly wider cards (max-width: 90%)
- Two-column form layout (if space allows)
- Maintain touch-friendly targets

**Typography:**
- Standard sizes
- Comfortable reading width

### 7.3 Desktop (≥ 1024px)

**Layout:**
- Centered content (max-width: 800px)
- Comfortable margins
- Hover states active

**Interactions:**
- Hover effects on cards/buttons
- Keyboard navigation optimized
- Mouse-optimized targets (can be smaller than 44px, but maintain accessibility)

---

## 8) Animation & Transitions

### 8.1 Principles

- **Purposeful**: Every animation serves a function
- **Subtle**: Never distracting
- **Fast**: Most animations < 300ms
- **Respectful**: Honor `prefers-reduced-motion`

### 8.2 Specific Animations

**Page Load:**
- Fade-in: 200ms
- Stagger: Form fields appear sequentially (50ms delay each)

**Form Submission:**
- Button: Loading spinner (1s linear infinite)
- Results: Fade-in + scale (300ms ease-out)

**Results Update:**
- Quantity: Number count-up animation (500ms ease-out) - optional
- Cards: Fade-in (200ms)

**Accordion:**
- Height: 300ms ease-in-out
- Chevron: 180° rotation (300ms)

**Toast:**
- Slide-in: 300ms ease-out (from right)
- Slide-out: 200ms ease-in (to right)

**Reduced Motion:**
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 9) Error States & Edge Cases

### 9.1 Form Errors

**Validation Errors:**
- Red border on input
- Error message below field
- Icon: ❌ (optional)
- `aria-invalid="true"`

**Network Errors:**
- Toast notification (error type)
- Error message in results card
- Retry button (if applicable)
- Error code displayed (monospace, small)

**Timeout Errors:**
- Clear message: "Request timed out. Please try again."
- Retry button
- `error_code` and `retry_after_ms` displayed

### 9.2 Results Edge Cases

**No Active NDCs:**
- No "Selected Package" section
- Warning badge: "No active NDCs available"
- List inactive NDCs in flags section
- Guidance: "Consider alternative drug or contact supplier"

**Mismatch (Unparseable SIG):**
- Error badge in flags
- Message: "Unable to parse SIG. Please verify directions."
- Results still shown (if partial parse possible)
- Guidance text

**Only Inactive NDCs:**
- Selected package shown with warning badge
- Clear indication: "Inactive NDC selected"
- Guidance: "Verify NDC status before dispensing"

**No Results:**
- Empty state message
- Guidance: "Try different search terms or verify NDC format"

---

## 10) Implementation Notes

### 10.1 Component Structure (SvelteKit)

**Recommended Components:**
```
src/lib/components/
├── Header.svelte
├── InputForm.svelte
│   ├── DrugInput.svelte
│   ├── SigInput.svelte
│   ├── DaysSupplyInput.svelte
│   └── AdvancedOptions.svelte
├── ResultsCard.svelte
│   ├── QuantityDisplay.svelte
│   ├── SelectedPackage.svelte
│   ├── FlagsSection.svelte
│   ├── AlternatesList.svelte
│   └── CopyJsonButton.svelte
├── Toast.svelte
├── Button.svelte
├── Input.svelte
├── Badge.svelte
└── Card.svelte
```

### 10.2 State Management

**Form State:**
- Reactive Svelte stores or component state
- Validation on blur
- Debounced API calls (if needed)

**Results State:**
- Store API response
- Loading/error states
- Toast queue

### 10.3 API Integration

**Endpoint**: `POST /api/v1/compute`

**Request Handling:**
- Validate form before submission
- Show loading state
- Handle errors gracefully
- Update results state

**Response Handling:**
- Parse JSON response
- Update UI with results
- Show flags/warnings
- Announce to screen readers

### 10.4 Styling Approach

**Recommended**: CSS Modules or Tailwind CSS

**If Tailwind:**
- Use design tokens as Tailwind config
- Custom color palette
- Custom spacing scale
- Component classes

**If CSS Modules:**
- Component-scoped styles
- Shared design tokens (CSS variables)
- Utility classes for common patterns

---

## 11) Design Mockups (Text-Based)

### 11.1 Initial State

```
┌─────────────────────────────────────────────┐
│  🏥 NDC Quantity Calculator                 │
├─────────────────────────────────────────────┤
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │  Calculate Quantity                   │ │
│  │  ───────────────────────────────────  │ │
│  │                                       │ │
│  │  Drug Name or NDC *                   │ │
│  │  ┌─────────────────────────────────┐ │ │
│  │  │ e.g., amoxicillin 500 mg cap... │ │ │
│  │  └─────────────────────────────────┘ │ │
│  │                                       │ │
│  │  SIG (Directions) *                   │ │
│  │  ┌─────────────────────────────────┐ │ │
│  │  │ e.g., 1 cap PO BID              │ │ │
│  │  └─────────────────────────────────┘ │ │
│  │                                       │ │
│  │  Days Supply *                        │ │
│  │  ┌─────────────────────────────────┐ │ │
│  │  │ 30                              │ │ │
│  │  └─────────────────────────────────┘ │ │
│  │                                       │ │
│  │  ┌─────────────────────────────────┐ │ │
│  │  │  ▼ Advanced Options             │ │ │
│  │  └─────────────────────────────────┘ │ │
│  │                                       │ │
│  │  ┌─────────────────────────────────┐ │ │
│  │  │      [Calculate]                │ │ │
│  │  └─────────────────────────────────┘ │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │  Enter drug information above and     │ │
│  │  click Calculate                      │ │
│  └───────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

### 11.2 Results State

```
┌─────────────────────────────────────────────┐
│  🏥 NDC Quantity Calculator                 │
├─────────────────────────────────────────────┤
│                                             │
│  [Input Form - Same as above]              │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │  Results                               │ │
│  │  ───────────────────────────────────  │ │
│  │                                       │ │
│  │            ┌──────────────┐           │ │
│  │            │      60      │           │ │
│  │            │   capsules   │           │ │
│  │            └──────────────┘           │ │
│  │                                       │ │
│  │  ┌─────────────────────────────────┐  │ │
│  │  │  Selected Package               │  │ │
│  │  │  ───────────────────────────────  │  │ │
│  │  │  NDC: 00000-1111-22  [Active] ✓ │  │ │
│  │  │  Package Size: 60               │  │ │
│  │  │  Packs: 1                       │  │ │
│  │  │  Overfill: 0%                   │  │ │
│  │  └─────────────────────────────────┘  │ │
│  │                                       │ │
│  │  ┌─────────────────────────────────┐  │ │
│  │  │  ▼ Alternate Packages (2)        │  │ │
│  │  └─────────────────────────────────┘  │ │
│  │                                       │ │
│  │  ┌─────────────────────────────────┐  │ │
│  │  │  [📋 Copy JSON Response]        │  │ │
│  │  └─────────────────────────────────┘  │ │
│  └───────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 12) Testing Checklist

### 12.1 Visual Testing

- [ ] All breakpoints render correctly
- [ ] Colors meet contrast requirements
- [ ] Typography is readable at all sizes
- [ ] Spacing is consistent
- [ ] Icons are clear and appropriate
- [ ] Loading states are clear
- [ ] Error states are obvious

### 12.2 Interaction Testing

- [ ] All buttons are clickable
- [ ] Form validation works
- [ ] Loading states appear
- [ ] Results update correctly
- [ ] Copy JSON works
- [ ] Accordions expand/collapse
- [ ] Toasts appear and dismiss

### 12.3 Accessibility Testing

- [ ] Keyboard navigation works
- [ ] Screen reader announces changes
- [ ] Focus indicators are visible
- [ ] Color contrast passes WCAG AA
- [ ] Form labels are associated
- [ ] Error messages are announced
- [ ] Works with zoom up to 200%

### 12.4 Browser Testing

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## 13) Future Enhancements (Post-MVP)

**Visual:**
- Dark mode support
- Customizable themes
- Chart visualizations (package size distribution)
- Animation preferences

**UX:**
- Recent calculations history
- Favorites/bookmarks
- Export to PDF
- Print-friendly view
- Shareable calculation links

**Accessibility:**
- High contrast mode
- Font size preferences
- Additional keyboard shortcuts

---

## 14) Design Assets

**Icons Needed:**
- Calculator (header)
- Chevron (accordion)
- Copy (JSON button)
- Checkmark (success)
- Warning (warnings)
- Error (errors)
- Info (information)
- Spinner (loading)

**Recommendation**: Use icon library (e.g., Heroicons, Lucide, or similar)

**Illustrations:**
- Empty state illustration (optional)
- Error state illustration (optional)

---

## 15) Design Handoff

**Deliverables:**
1. This specification document
2. (Optional) Figma/Sketch design files
3. Component library documentation
4. Design tokens (CSS variables)
5. Accessibility audit report

**Developer Notes:**
- All measurements in rem/px
- Color values provided
- Spacing scale defined
- Breakpoints specified
- Animation timings included
- Accessibility requirements documented

---

**End of Front-End Specification**

