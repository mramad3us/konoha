import { createElement } from '../utils/dom.ts';

export class KeybindingsPanel {
  readonly element: HTMLElement;
  private visible = false;

  constructor() {
    this.element = createElement('div', { className: 'keybindings-panel' });

    const groups: Array<{ keys: string; descs: string }[]> = [
      [
        { keys: 'h', descs: 'W' },
        { keys: 'j', descs: 'S' },
        { keys: 'k', descs: 'N' },
        { keys: 'l', descs: 'E' },
        { keys: 'y', descs: 'NW' },
        { keys: 'u', descs: 'NE' },
        { keys: 'b', descs: 'SW' },
        { keys: 'n', descs: 'SE' },
      ],
      [
        { keys: ',', descs: 'Faster' },
        { keys: ';', descs: 'Slower' },
        { keys: '@', descs: 'Jutsu' },
      ],
      [
        { keys: 'a/z/e', descs: 'Attack' },
        { keys: 'q/s/d', descs: 'Defend' },
      ],
      [
        { keys: '.', descs: 'Wait' },
        { keys: 'f', descs: 'Interact' },
        { keys: 'c', descs: 'Character' },
        { keys: 'm', descs: 'Missions' },
        { keys: '?', descs: 'Keys' },
      ],
    ];

    groups.forEach((group, gi) => {
      const groupEl = createElement('div', { className: 'keybindings-panel__group' });

      group.forEach((binding, bi) => {
        const key = createElement('span', { className: 'keybindings-panel__key', text: binding.keys });
        const eq = document.createTextNode('=');
        const desc = createElement('span', { className: 'keybindings-panel__desc', text: binding.descs });
        groupEl.appendChild(key);
        groupEl.appendChild(eq);
        groupEl.appendChild(desc);

        if (bi < group.length - 1) {
          groupEl.appendChild(document.createTextNode('  '));
        }
      });

      this.element.appendChild(groupEl);

      if (gi < groups.length - 1) {
        this.element.appendChild(
          createElement('span', { className: 'keybindings-panel__separator', text: '|' })
        );
      }
    });
  }

  toggle(): void {
    this.visible = !this.visible;
    this.element.classList.toggle('keybindings-panel--visible', this.visible);
  }

  isVisible(): boolean {
    return this.visible;
  }
}
