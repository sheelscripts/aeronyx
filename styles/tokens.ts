/**
 * Aeronyx Design System Tokens
 * Inspired by MongoDB Design Analysis (DESIGN.md)
 */

export const colors = {
  // Brand colors
  primary: "#00ed64",        // Bright brand green pill CTA
  primaryDeep: "#00b545",    // Darker green for pressed states
  primaryPressed: "#008c34", // Deeper green
  onPrimary: "#001e2b",      // Deep navy/teal text on green background

  brandTealDeep: "#001e2b",  // Deep dark teal/navy for hero and dark mode surfaces
  brandTeal: "#003d4f",      // Mid-spectrum teal
  brandTealMid: "#00684a",   // Lighter teal for hero platform card elements

  // Canvas and Surfaces
  canvas: "#ffffff",         // Page background and primary card surface
  canvasDark: "#001e2b",     // Darker terminal/mockup backgrounds
  surface: "#f9fbfa",        // Page subtle section background
  surfaceSoft: "#f4f7f6",    // Lighter section background
  surfaceFeature: "#e3fcef", // Lighter mint tint for highlight cards

  // Borders & Dividers
  hairline: "#e1e5e8",        // Primary card borders
  hairlineSoft: "#eceff1",    // Subtle separators
  hairlineStrong: "#c1ccd6",  // Input borders
  hairlineDark: "#1c2d38",    // Borders on dark teal surfaces

  // Text colors
  ink: "#001e2b",             // Primary headings and body text
  charcoal: "#1c2d38",        // Secondary body emphasis
  slate: "#3d4f5b",           // Secondary info text
  steel: "#5c6c7a",           // Tertiary info/captions
  stone: "#7c8c9a",           // Muted labels
  muted: "#a8b3bc",           // Disabled items and placeholders
  onDark: "#ffffff",          // White text on dark teal backgrounds
  onDarkMuted: "#a8b3bc",     // Secondary text on dark teal backgrounds

  // AQI Semantic Colors (Standardized)
  aqiGood: "#22c55e",
  aqiSatisfactory: "#a3e635",
  aqiModerate: "#b45309",
  aqiPoor: "#f97316",
  aqiVeryPoor: "#ef4444",
  aqiSevere: "#991b1b",
};

export const typography = {
  fontFamily: {
    display: "Space Grotesk, sans-serif",
    body: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    code: "Source Code Pro, monospace",
  },
  fontSize: {
    hero: "72px",
    displayLg: "56px",
    heading1: "48px",
    heading2: "36px",
    heading3: "28px",
    heading4: "22px",
    heading5: "18px",
    subtitle: "18px",
    bodyMd: "16px",
    bodySm: "14px",
    caption: "13px",
    micro: "12px",
    microUppercase: "11px",
  },
  fontWeight: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};

export const rounded = {
  xs: "4px",     // Badges, tags
  sm: "6px",     // Small chips, tooltips
  md: "8px",     // Inputs, search tab
  lg: "12px",    // Standard cards, widgets
  xl: "16px",    // Hero features, panels
  xxl: "24px",   // Large showcase elements
  full: "9999px" // Buttons, pills, status indicators
};

export const spacing = {
  xxs: "4px",
  xs: "8px",
  sm: "12px",
  md: "16px",
  lg: "20px",
  xl: "24px",
  xxl: "32px",
  xxxl: "40px",
  sectionSm: "48px",
  section: "64px",
  sectionLg: "96px",
  hero: "120px",
};

export const elevation = {
  level0: "none",
  level1: "0px 1px 2px 0px rgba(0, 30, 43, 0.04)",
  level2: "0px 4px 12px 0px rgba(0, 30, 43, 0.08)",
  level3: "0px 12px 24px -4px rgba(0, 30, 43, 0.12)",
  level4: "0px 16px 48px -8px rgba(0, 30, 43, 0.16)",
};

export const transition = {
  fast: "100ms ease",
  normal: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
  smooth: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
  spring: "300ms cubic-bezier(0.34, 1.56, 0.64, 1)",
};
