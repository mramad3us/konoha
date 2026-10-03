import { createElement } from '../utils/dom.ts';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export function showConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise(resolve => {
    const overlay = createElement('div', { className: 'confirm-overlay' });

    const dialog = createElement('div', { className: 'confirm-dialog' });

    dialog.appendChild(
      createElement('div', { className: 'confirm-dialog__title', text: options.title })
    );

    dialog.appendChild(
      createElement('div', { className: 'confirm-dialog__message', text: options.message })
    );

    const actions = createElement('div', { className: 'confirm-dialog__actions' });

    const cancelBtn = createElement('button', {
      className: 'confirm-dialog__btn',
      text: options.cancelText ?? 'Cancel',
      onClick: () => { overlay.remove(); resolve(false); },
    });

    const confirmBtn = createElement('button', {
      className: `confirm-dialog__btn ${options.danger ? 'confirm-dialog__btn--danger' : ''}`,
      text: options.confirmText ?? 'Confirm',
      onClick: () => { overlay.remove(); resolve(true); },
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    dialog.appendChild(actions);
    overlay.appendChild(dialog);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { overlay.remove(); resolve(false); }
    });

    document.body.appendChild(overlay);
  });
}
