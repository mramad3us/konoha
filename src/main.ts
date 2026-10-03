import './styles/base.css';
import './styles/hud.css';
import { boot } from './screens/app.ts';

boot(document.getElementById('app')!).catch(err => {
  console.error('Failed to boot Konoha:', err);
  const root = document.getElementById('app');
  if (root) root.innerHTML = '<p style="color:#c0303a;font-family:monospace;padding:2rem">Failed to start. See console.</p>';
});
