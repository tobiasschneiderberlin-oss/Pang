/** @type {import('next').NextConfig} */
const nextConfig = {
  // Type errors break the build now. The previous `ignoreBuildErrors: true`
  // hid 3 real type errors that have been fixed; keeping the gate on means
  // future regressions surface in CI instead of leaking to production.
  typescript: {
    ignoreBuildErrors: false,
  },
  // Next 16 dropped the built-in `next lint` and the `eslint` key in this
  // config file. Lint is now a standalone concern — run ESLint directly
  // via a `lint` script once a flat config is added.
  images: {
    unoptimized: true,
  },
  // Silence the workspace-root inference warning: the lockfile lives here,
  // not in the parent directory's stray `package-lock.json`.
  turbopack: {
    root: import.meta.dirname,
  },
}

export default nextConfig
