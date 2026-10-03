/** Generate a unique save ID */
export function generateSaveId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `save_${timestamp}_${random}`;
}
