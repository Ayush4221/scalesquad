/** User-facing network text. Keep wording out of rendering and transport code. */
export const networkStrings = {
  theServiceReturnedAnUnreadableResponse:
    'The service returned an unreadable response. Please try again.',
  theRequestTookTooLongPlease: 'The request took too long. Please try again.',
  cannotReachTheServiceCheckYour: 'Cannot reach the service. Check your connection and try again.',
  somethingWentWrongPleaseTryAgain: 'Something went wrong. Please try again.',
  chatConnectionFailed: 'Chat connection failed',
  invalidChatMessage: 'Invalid chat message',
  messageNotSent: 'Message not sent',
} as const;
