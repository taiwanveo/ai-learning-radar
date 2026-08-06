---
name: artifact-template-market-trends-report
description: Template and design system for generating comprehensive, visually rich Market Trends Reports, TAM/SAM/SOM sizing, industry landscape analysis, macro/micro trend synthesis, and strategic pitch deck backing documents.
---

# Market Trends Report Artifact Template

Use this skill whenever you need to design or generate a Market Trends Report artifact, market analysis section for a pitch deck, or industry landscape overview.

## Core Structure of a Market Trends Report

Every Market Trends Report should be structured logically into the following 6 core sections:

1. **Executive Summary**
   - High-level takeaways, key growth drivers, and market outlook summary.
   - 3-4 key highlight metric cards (e.g., CAGR %, TAM $, Key Trend Keyword, Target Year).

2. **Market Sizing & Growth Forecast (TAM / SAM / SOM)**
   - **TAM (Total Addressable Market)**: Total global market demand.
   - **SAM (Serviceable Addressable Market)**: Segment targeted by product scope.
   - **SOM (Serviceable Obtainable Market)**: Realistic market share capture in 3-5 years.
   - Historical CAGR vs Projected CAGR with clear timeline charts.

3. **Key Market Drivers & Macro Trends**
   - Technology shifts (e.g., AI adoption, cloud migration, automation).
   - Economic & Regulatory drivers.
   - Consumer / Enterprise behavior trends.
   - Formatted as trend cards with impact rating (High / Medium / Low) and direction (Accelerating / Emerging / Maturing).

4. **Competitive Landscape & Market Map**
   - 2x2 Matrix grid or Tiered Market Map (Incumbents, Fast Followers, Disruptors).
   - Feature matrix table comparing key players, pricing models, and key differentiators.

5. **Customer Segments & Demand Signals**
   - Buyer persona breakdown (Enterprise, SMB, Consumer).
   - Key pain points, willingness to pay, and buying criteria.

6. **Strategic Implications & Pitch Deck Recommendations**
   - Summary recommendations for product positioning, GTM strategy, and investment thesis.

## Formatting & Design Guidelines

- **Typography**: Clean sans-serif (Inter, System UI), clear heading hierarchy (`h1` -> `h2` -> `h3`).
- **Data Callouts**: Highlight key metrics (e.g., "$45.2B TAM", "24.5% CAGR") in large bold stat cards.
- **Tables**: Styled with subtle borders, alternating row backgrounds, and clear column alignment (left-align text, right-align numbers).
- **Color Coding**:
  - Positive / Growth: Emerald / Green `#10b981`
  - Neutral / Steady: Slate / Blue `#3b82f6`
  - Caution / Risk: Amber / Orange `#f59e0b`

## HTML/CSS Snippet Template for Artifacts

```html
<div class="market-report-container">
  <header class="report-header">
    <span class="category-tag">MARKET ANALYSIS</span>
    <h1>Global AI Learning & Skill Intelligence Market (2026-2030)</h1>
    <p class="subtitle">Comprehensive analysis of TAM, CAGR growth drivers, competitive dynamics, and strategic opportunities.</p>
  </header>

  <!-- Metric Grid -->
  <div class="metric-grid">
    <div class="metric-card">
      <span class="label">Total Addressable Market (TAM)</span>
      <span class="value">$128.5B</span>
      <span class="badge positive">+18.4% CAGR</span>
    </div>
  </div>
</div>
```
