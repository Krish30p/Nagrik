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
              "inverse-primary": "#80d8a9",
              "secondary-fixed": "#ffdfa0",
              "on-surface-variant": "#3f4942",
              "on-surface": "#1b1c1a",
              "on-tertiary-fixed": "#0d1c2e",
              "surface-container-highest": "#e4e2de",
              "on-error-container": "#93000a",
              "primary": "#00603d",
              "on-primary-fixed-variant": "#005234",
              "tertiary": "#465468",
              "surface-bright": "#fbf9f5",
              "error-container": "#ffdad6",
              "on-primary": "#ffffff",
              "on-tertiary-fixed-variant": "#3a485b",
              "tertiary-container": "#5e6c81",
              "secondary": "#795900",
              "surface-container-low": "#f5f3ef",
              "surface-container-lowest": "#ffffff",
              "primary-fixed": "#9cf5c4",
              "on-primary-fixed": "#002112",
              "surface-tint": "#006c46",
              "inverse-on-surface": "#f2f0ed",
              "on-secondary-fixed": "#261a00",
              "primary-container": "#1a7a52",
              "on-secondary-fixed-variant": "#5c4300",
              "on-secondary-container": "#6d5000",
              "surface-dim": "#dbdad6",
              "on-primary-container": "#acffd0",
              "inverse-surface": "#30312e",
              "tertiary-fixed": "#d5e3fc",
              "background": "#fbf9f5",
              "surface-container-high": "#eae8e4",
              "surface": "#fbf9f5",
              "secondary-container": "#ffbf00",
              "primary-fixed-dim": "#80d8a9",
              "secondary-fixed-dim": "#fbbc00",
              "surface-variant": "#e4e2de",
              "on-background": "#1b1c1a",
              "outline": "#6f7a72",
              "on-tertiary": "#ffffff",
              "error": "#ba1a1a",
              "tertiary-fixed-dim": "#b9c7df",
              "outline-variant": "#bec9c0",
              "surface-container": "#efeeea",
              "on-error": "#ffffff",
              "on-secondary": "#ffffff",
              "on-tertiary-container": "#e4edff"
      },
      "borderRadius": {
              "DEFAULT": "0.25rem",
              "lg": "0.5rem",
              "xl": "0.75rem",
              "full": "9999px"
      },
      "spacing": {
              "gutter": "24px",
              "margin-desktop": "40px",
              "unit": "8px",
              "margin-mobile": "16px",
              "container-max": "1200px"
      },
      "fontFamily": {
              "body-lg": ["Inter"],
              "body-sm": ["Inter"],
              "label-bold": ["Inter"],
              "body-md": ["Inter"],
              "label-md": ["Inter"],
              "headline-lg": ["Inter"],
              "headline-md": ["Inter"],
              "headline-lg-mobile": ["Inter"]
      },
      "fontSize": {
              "body-lg": ["18px", { "lineHeight": "28px", "fontWeight": "400" }],
              "body-sm": ["14px", { "lineHeight": "20px", "fontWeight": "400" }],
              "label-bold": ["14px", { "lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "600" }],
              "body-md": ["16px", { "lineHeight": "24px", "fontWeight": "400" }],
              "label-md": ["12px", { "lineHeight": "16px", "fontWeight": "500" }],
              "headline-lg": ["32px", { "lineHeight": "40px", "letterSpacing": "-0.02em", "fontWeight": "700" }],
              "headline-md": ["20px", { "lineHeight": "28px", "fontWeight": "600" }],
              "headline-lg-mobile": ["24px", { "lineHeight": "32px", "letterSpacing": "-0.01em", "fontWeight": "700" }]
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
}
