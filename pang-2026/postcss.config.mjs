/**
 * Tailwind v4 uses a dedicated PostCSS plugin. No `autoprefixer` or
 * `tailwindcss` imports — v4's plugin does both.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
