/** Visual style: Expressive (default, teal) or Bento (pastel violet). Device-local preference. */
export type AppStyle = 'expressive' | 'bento';
const KEY = 'wout-style';
const BENTO_FONT = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';

export function getStyle(): AppStyle {
  try { return localStorage.getItem(KEY) === 'bento' ? 'bento' : 'expressive'; } catch { return 'expressive'; }
}

export function applyStyle(style: AppStyle = getStyle()) {
  const root = document.documentElement;
  if (style === 'bento') {
    root.dataset.style = 'bento';
    if (!document.getElementById('bento-font')) {
      const link = Object.assign(document.createElement('link'), { id: 'bento-font', rel: 'stylesheet', href: BENTO_FONT });
      document.head.appendChild(link);
    }
  } else {
    delete root.dataset.style;
  }
  // Status-bar color follows the page background.
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', bg || '#f4fbf8'));
}

export function setStyle(style: AppStyle) {
  try { localStorage.setItem(KEY, style); } catch { /* private mode: applies for this visit only */ }
  applyStyle(style);
}
