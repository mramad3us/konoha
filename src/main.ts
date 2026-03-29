import './styles/variables.css';
import './styles/reset.css';
import './styles/typography.css';
import './styles/animations.css';
import './styles/components.css';
import './styles/landing.css';
import './styles/game.css';

import { screenManager } from './systems/screenManager.ts';
import { saveSystem } from './systems/saveSystem.ts';
import { loadVolumeSettings } from './systems/volumeManager.ts';
import { unlockAudio } from './systems/audioContext.ts';
import { startMenuMusic, stopMenuMusic } from './systems/musicSystem.ts';
import { renderLanding } from './screens/landing.ts';
import { renderNewGame } from './screens/newGame.ts';
import { renderLoadGame } from './screens/loadGame.ts';
import { renderSettings } from './screens/settings.ts';
import { renderGame } from './screens/game.ts';

async function boot(): Promise<void> {
  // Initialize save system + volume settings
  await saveSystem.init();
  await loadVolumeSettings();

  // Unlock audio on first user interaction, then start music
  const unlockAndPlay = () => {
    unlockAudio();
    // Small delay to let context initialize
    setTimeout(() => startMenuMusic(), 100);
    document.removeEventListener('click', unlockAndPlay);
    document.removeEventListener('keydown', unlockAndPlay);
  };
  document.addEventListener('click', unlockAndPlay);
  document.addEventListener('keydown', unlockAndPlay);

  // Start/stop music based on screen
  screenManager.onTransition((t) => {
    if (t.to === 'landing') startMenuMusic();
    else if (t.from === 'landing') stopMenuMusic();
  });

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
