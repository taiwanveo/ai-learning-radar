---
name: artifact-template-simple-dark-mode
description: Sleek, high-contrast Dark Mode design system for HTML, SVG, and Markdown artifacts. Provides deep backgrounds, glowing accent highlights, glassmorphism cards, and premium visual aesthetics.
---

# Simple Dark Mode Artifact Design System

Use this skill to style HTML, SVG, or Markdown artifacts in a premium, modern Dark Mode theme suitable for pitch decks, developer dashboards, and executive presentations.

## Color Tokens

```css
:root {
  /* Backgrounds */
  --bg-primary: #0b0f19;
  --bg-secondary: #111827;
  --bg-tertiary: #1f2937;
  --bg-card: rgba(17, 24, 39, 0.75);

  /* Text Colors */
  --text-primary: #f9fafb;
  --text-secondary: #9ca3af;
  --text-muted: #6b7280;

  /* Accents & Gradients */
  --accent-primary: #6366f1;
  --accent-cyan: #06b6d4;
  --accent-emerald: #10b981;
  --accent-pink: #ec4899;
  --gradient-accent: linear-gradient(135deg, #6366f1 0%, #06b6d4 100%);
  --gradient-card: linear-gradient(180deg, rgba(31, 41, 55, 0.6) 0%, rgba(17, 24, 39, 0.8) 100%);

  /* Borders & Shadows */
  --border-color: rgba(255, 255, 255, 0.1);
  --border-glow: rgba(99, 102, 241, 0.3);
  --shadow-glow: 0 0 20px rgba(99, 102, 241, 0.15);

  /* Border Radius */
  --radius-md: 12px;
  --radius-lg: 20px;
}
```

## Styling Template Code

```html
<style>
  body {
    background-color: var(--bg-primary);
    color: var(--text-primary);
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    padding: 2rem;
  }
  .glass-card {
    background: var(--gradient-card);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  }
  .gradient-text {
    background: var(--gradient-accent);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    font-weight: 800;
  }
</style>
```

## Principles
1. **Deep Backdrops**: Use `#0b0f19` or `#0f172a` instead of pure `#000000` for reduced strain and richer depth.
2. **Glassmorphism**: Use translucent card backgrounds with `backdrop-filter: blur()` and subtle white 10% opacity borders.
3. **Vibrant Accents**: Use gradient text and glowing accent lights to emphasize key numbers and titles.
