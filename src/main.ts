import './styles/base.css';
import './styles/hud.css';
import './styles/screens.css';
import { boot } from './screens/app.ts';

window.addEventListener('unhandledrejection', e => console.error('[qa] unhandled:', (e.reason as Error)?.stack ?? e.reason));
window.addEventListener('error', e => console.error('[qa] error:', String(e.error?.stack ?? e.message).replace(/\n/g, ' | ')));

boot(document.getElementById('app')!).catch(err => {
  console.error('Failed to boot Konoha:', err);
  const root = document.getElementById('app');
  if (root) root.innerHTML = '<p style="color:#c0303a;font-family:monospace;padding:2rem">Failed to start. See console.</p>';
});
