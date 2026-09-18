export function formatApiError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message: string }).message;
    // Extract Arabic part before any delimiter like "·"
    return msg.split('·')[0]?.trim() || 'حدث خطأ غير متوقع';
  }
  return 'حدث خطأ غير متوقع';
}
