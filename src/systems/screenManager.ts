import type { ScreenId, ScreenTransition } from '../types/screens.ts';
import { SCREEN_TRANSITION_MS } from '../core/constants.ts';
import { getAppRoot } from '../utils/dom.ts';

export type ScreenRenderer = (container: HTMLElement) => void | Promise<void>;

class ScreenManager {
  private screens = new Map<ScreenId, ScreenRenderer>();
  private currentScreen: ScreenId | null = null;
  private history: ScreenId[] = [];
  private transitioning = false;
  private listeners: Array<(transition: ScreenTransition) => void> = [];

  /** Register a screen renderer */
  register(id: ScreenId, renderer: ScreenRenderer): void {
    this.screens.set(id, renderer);
  }

  /** Navigate to a screen */
  async navigateTo(id: ScreenId): Promise<void> {
    if (this.transitioning || id === this.currentScreen) return;

    const renderer = this.screens.get(id);
    if (!renderer) throw new Error(`Screen "${id}" not registered`);

    this.transitioning = true;
    const root = getAppRoot();
    const from = this.currentScreen;

    const transition: ScreenTransition = {
      from,
      to: id,
      direction: 'forward',
    };

    this.listeners.forEach(fn => fn(transition));

    // Fade out current
    if (root.children.length > 0) {
      root.classList.add('screen-exit');
      await new Promise(r => setTimeout(r, SCREEN_TRANSITION_MS));
      root.classList.remove('screen-exit');
    }

    root.innerHTML = '';

    // Create screen container
    const screenEl = document.createElement('div');
    screenEl.className = `screen screen--${id}`;
    screenEl.setAttribute('data-screen', id);
    root.appendChild(screenEl);

    await renderer(screenEl);

    // Fade in
    root.classList.add('screen-enter');
    await new Promise(r => setTimeout(r, SCREEN_TRANSITION_MS));
    root.classList.remove('screen-enter');

    if (from) this.history.push(from);
    this.currentScreen = id;
    this.transitioning = false;
  }

  /** Go back to previous screen */
  async goBack(): Promise<void> {
    const prev = this.history.pop();
    if (!prev) return;

    const renderer = this.screens.get(prev);
    if (!renderer) return;

    this.transitioning = true;
    const root = getAppRoot();

    const transition: ScreenTransition = {
      from: this.currentScreen,
      to: prev,
      direction: 'back',
    };

    this.listeners.forEach(fn => fn(transition));

    root.classList.add('screen-exit');
    await new Promise(r => setTimeout(r, SCREEN_TRANSITION_MS));
    root.classList.remove('screen-exit');

    root.innerHTML = '';
    const screenEl = document.createElement('div');
    screenEl.className = `screen screen--${prev}`;
    screenEl.setAttribute('data-screen', prev);
    root.appendChild(screenEl);

    await renderer(screenEl);

    root.classList.add('screen-enter');
    await new Promise(r => setTimeout(r, SCREEN_TRANSITION_MS));
    root.classList.remove('screen-enter');

    this.currentScreen = prev;
    this.transitioning = false;
  }

  /** Listen for screen transitions */
  onTransition(fn: (transition: ScreenTransition) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  getCurrentScreen(): ScreenId | null {
    return this.currentScreen;
  }
}

export const screenManager = new ScreenManager();
