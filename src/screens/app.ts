/**
 * App shell: routes between screens. Dev scenarios (?dev=…) jump straight into play for QA.
 */

import { GameView } from '../ui/gameView.ts';
import { devScenario } from '../dev/scenarios.ts';
import { engine } from '../audio/engine.ts';

export async function boot(root: HTMLElement): Promise<void> {
  const unlock = () => engine.unlock();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  await document.fonts.ready;
  const dev = new URLSearchParams(location.search).get('dev');
  if (dev) {
    const game = devScenario(dev);
    const view = new GameView(root, game, {
      onRequest: (_v, r) => { game.say(`[request: ${r.kind}]`, 'system'); },
      onMenu: () => {},
    });
    view.start();
    (window as unknown as { __view: GameView }).__view = view;
    return;
  }
  root.textContent = 'Konoha';
}
