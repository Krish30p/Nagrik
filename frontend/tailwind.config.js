/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      "colors": {
        // Base / Paper
        "paper": "#F7F3EA",
        "paper-raised": "#FFFFFF",
        "ink": "#1B1B16",
        "ink-muted": "#5C5A4E",
        "rule": "#DDD6C4",

        // Brand
        "seal": "#1F3A33",
        "seal-tint": "#E7EEE9",
        "terracotta": "#C2542D",
        "terracotta-tint": "#F6E3D8",
        "turmeric": "#D9A02B",

        // Standard overrides to map to our brand tokens
        "primary": "#1F3A33", // seal
        "primary-container": "#E7EEE9", // seal-tint
        "on-primary-container": "#1F3A33", // seal
        "secondary": "#C2542D", // terracotta
        "secondary-container": "#F6E3D8", // terracotta-tint
        "on-secondary-container": "#C2542D",
        "background": "#F7F3EA", // paper
        "surface": "#F7F3EA", // paper
        "on-surface": "#1B1B16", // ink
        "on-surface-variant": "#5C5A4E", // ink-muted
        "outline-variant": "#DDD6C4", // rule
        "error": "#A23B2E", // status-escalated
        "danger": "#A23B2E", // map to escalated red
        "surface-container-lowest": "#FFFFFF",
        "surface-container-low": "#F7F3EA",
        "surface-container-high": "#ECE8DF",

        // Status
        "status-verifying": "#8A7F66",
        "status-reported": "#B8862B",
        "status-routed": "#2D5A8C",
        "status-in-progress": "#1F3A33",
        "status-escalated": "#A23B2E",
        "status-resolved": "#4A6B4E",
        "status-duplicate": "#9A958A",

        // Severity
        "severity-low": "#B7C4A3",
        "severity-moderate": "#D9A02B",
        "severity-high": "#C2542D",
        "severity-critical": "#A23B2E",
      },
      "borderRadius": {
        "DEFAULT": "0.125rem", // 2px
        "sm": "0.125rem",      // 2px
        "md": "0.25rem",       // 4px
        "lg": "0.25rem",       // 4px (structural containers)
        "xl": "0.5rem",        // 8px
        "full": "9999px"       // stamps and pills
      },
      "spacing": {
        "ledger-gap": "1px",
        "form-gutter": "1.5rem",
        "section-margin": "2rem",
        "stack-xs": "0.25rem",
        "stack-sm": "0.5rem",
        "stack-md": "1rem"
      },
      "fontFamily": {
        "display": ["\"Source Serif 4\"", "Georgia", "serif"],
        "ui": ["\"IBM Plex Sans\"", "-apple-system", "sans-serif"],
        "mono": ["\"IBM Plex Mono\"", "monospace"],
        // backward compatibility aliases
        "body-lg": ["\"IBM Plex Sans\"", "sans-serif"],
        "body-sm": ["\"IBM Plex Sans\"", "sans-serif"],
        "label-bold": ["\"IBM Plex Mono\"", "monospace"],
        "body-md": ["\"IBM Plex Sans\"", "sans-serif"],
        "label-md": ["\"IBM Plex Mono\"", "monospace"],
        "headline-lg": ["\"Source Serif 4\"", "serif"],
        "headline-md": ["\"Source Serif 4\"", "serif"],
        "headline-lg-mobile": ["\"Source Serif 4\"", "serif"]
      },
      "fontSize": {
        "body-lg": ["18px", { "lineHeight": "28px", "fontWeight": "400" }],
        "body-sm": ["13px", { "lineHeight": "18px", "fontWeight": "400" }],
        "label-bold": ["13px", { "lineHeight": "16px", "letterSpacing": "0.02em", "fontWeight": "600" }],
        "body-md": ["15px", { "lineHeight": "22px", "fontWeight": "400" }],
        "label-md": ["12px", { "lineHeight": "16px", "fontWeight": "500" }],
        "headline-lg": ["32px", { "lineHeight": "40px", "letterSpacing": "-0.01em", "fontWeight": "700" }],
        "headline-md": ["20px", { "lineHeight": "28px", "fontWeight": "600" }],
        "headline-lg-mobile": ["24px", { "lineHeight": "32px", "letterSpacing": "-0.01em", "fontWeight": "700" }],
        // new scale
        "display-lg": ["40px", {"lineHeight": "44px", "letterSpacing": "-0.01em", "fontWeight": "600"}],
        "display-md": ["28px", {"lineHeight": "34px", "fontWeight": "600"}],
        "display-lg-mobile": ["32px", {"lineHeight": "36px", "fontWeight": "600"}],
        "code-md": ["14px", {"lineHeight": "20px", "letterSpacing": "0.02em", "fontWeight": "500"}],
        "code-sm": ["12px", {"lineHeight": "16px", "fontWeight": "500"}]
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
}
