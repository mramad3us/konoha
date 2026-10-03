/** Create a DOM element with optional classes and attributes */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options?: {
    className?: string;
    id?: string;
    text?: string;
    html?: string;
    attrs?: Record<string, string>;
    children?: (HTMLElement | string)[];
    onClick?: (e: Event) => void;
  }
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (options?.className) el.className = options.className;
  if (options?.id) el.id = options.id;
  if (options?.text) el.textContent = options.text;
  if (options?.html) el.innerHTML = options.html;
  if (options?.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) {
      el.setAttribute(key, value);
    }
  }
  if (options?.children) {
    for (const child of options.children) {
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else {
        el.appendChild(child);
      }
    }
  }
  if (options?.onClick) {
    el.addEventListener('click', options.onClick);
  }
  return el;
}

/** Get the app root element */
export function getAppRoot(): HTMLElement {
  const root = document.getElementById('app');
  if (!root) throw new Error('App root #app not found');
  return root;
}

/** Wait for a CSS animation/transition to complete */
export function waitForAnimation(el: HTMLElement): Promise<void> {
  return new Promise(resolve => {
    const handler = () => {
      el.removeEventListener('animationend', handler);
      el.removeEventListener('transitionend', handler);
      resolve();
    };
    el.addEventListener('animationend', handler);
    el.addEventListener('transitionend', handler);
  });
}

/** Stagger-animate a list of elements */
export function staggerReveal(elements: HTMLElement[], baseDelayMs: number): void {
  elements.forEach((el, i) => {
    el.style.animationDelay = `${i * baseDelayMs}ms`;
    el.classList.add('stagger-reveal');
  });
}
