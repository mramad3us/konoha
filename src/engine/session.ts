/**
 * Module-level state for the active game session.
 * Shared between newGame screen and game screen.
 */
export let activeSaveId: string | null = null;

export function setActiveSaveId(id: string | null): void {
  activeSaveId = id;
}
