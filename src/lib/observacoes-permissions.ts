export function canManageObservation(
  currentUserId: string,
  authorId: string | null
): boolean {
  if (!authorId) return false;
  return currentUserId === authorId;
}
