/**
 * Inlined theme bootstrap.
 *
 * Runs before first paint so a dark-theme user never sees a white flash. It is
 * the one place where an inline script is required, which is why the CSP allows
 * `'unsafe-inline'` for scripts.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('fsp-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (prefersDark ? 'dark' : 'light');
    var root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
  } catch (e) {}
})();
`.trim();

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}