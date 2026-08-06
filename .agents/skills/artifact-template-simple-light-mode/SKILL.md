---
name: artifact-template-simple-light-mode
description: Minimalist, clean Light Mode design system for HTML, SVG, and Markdown artifacts. Ensures high contrast, crisp typography, elegant cards, subtle borders, and accessible color palettes.
---

# Simple Light Mode Artifact Design System

Use this skill to style HTML, SVG, or Markdown artifacts in a clean, modern, high-contrast Light Mode theme.

## Color Tokens

```css
:root {
  /* Backgrounds */
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-tertiary: #f1f5f9;
  --bg-card: #ffffff;

  /* Text Colors */
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #64748b;

  /* Accents */
  --accent-primary: #2563eb;
  --accent-primary-hover: #1d4ed8;
  --accent-secondary: #0ea5e9;
  --accent-success: #10b981;
  --accent-warning: #f59e0b;
  --accent-danger: #ef4444;

  /* Borders & Shadows */
  --border-color: #e2e8f0;
  --border-subtle: #f1f5f9;
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04);

  /* Border Radius */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
}
```

## Styling Template Code

```html
<style>
  body {
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
    line-height: 1.6;
    margin: 0;
    padding: 2rem;
  }
  .card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    box-shadow: var(--shadow-sm);
    transition: box-shadow 0.2s ease, transform 0.2s ease;
  }
  .card:hover {
    box-shadow: var(--shadow-md);
  }
  .badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    font-size: 0.85rem;
    font-weight: 600;
    border-radius: 9999px;
    background: #dbeafe;
    color: #1e40af;
  }
</style>
```

## Principles
1. **High Contrast**: Primary text is near-black (`#0f172a`) on white or light gray background.
2. **Subtle Elevation**: Use soft borders (`#e2e8f0`) with light drop shadows instead of heavy outlines.
3. **Clean Visual Hierarchy**: Font sizes stepped predictably: Title (28-36px), Heading (20-24px), Subheading (16-18px), Body (14-16px), Caption (12-13px).
