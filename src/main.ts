import './styles/variables.css';
import './styles/reset.css';
import './styles/typography.css';
import './styles/animations.css';
import './styles/components.css';
import './styles/landing.css';
import './styles/game.css';

import { screenManager } from './systems/screenManager.ts';
import { saveSystem } from './systems/saveSystem.ts';
import { renderLanding } from './screens/landing.ts';
import { renderNewGame } from './screens/newGame.ts';
import { renderLoadGame } from './screens/loadGame.ts';
import { renderSettings } from './screens/settings.ts';
import { renderGame } from './screens/game.ts';

async function boot(): Promise<void> {
  // Initialize save system
  await saveSystem.init();

  // Register all screens
  screenManager.register('landing', renderLanding);
  screenManager.register('newGame', renderNewGame);
  screenManager.register('loadGame', renderLoadGame);
  screenManager.register('settings', renderSettings);
  screenManager.register('game', renderGame);

  // Navigate to landing
  await screenManager.navigateTo('landing');
}

boot().catch(err => {
  console.error('Failed to boot Konoha:', err);
  const root = document.getElementById('app');
  if (root) {
    root.innerHTML = `<div style="color:#b22234;font-family:monospace;padding:2rem;">
      <p>Failed to initialize. Check console for details.</p>
    </div>`;
  }
});
