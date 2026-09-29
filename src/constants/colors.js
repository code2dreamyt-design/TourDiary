// "Forest Night" — dark theme, keeping the app's forest-green identity.
// Deliberately avoids gradients/glassmorphism per V1 design guidelines.
//
// Token rules (why some tokens come in pairs):
//  - `primary` is a FILL colour (buttons, checkboxes, camera button) that
//    always carries white text.  `primaryText` is the lighter green used
//    for TEXT / ICONS / OUTLINES that sit directly on dark surfaces.
//  - `danger` is a FILL colour (delete button, white text).  `dangerText`
//    is the lighter red for error text / icons on dark surfaces.
//  - `header` is the app-bar / profile-banner colour.
// All text pairs below were checked against WCAG AA (4.5:1) contrast.
export const COLORS = {
  primary: '#2F7D50', // button / checkbox fill (white text on top = 5.0:1)
  primaryText: '#7FD1A0', // green text, icons, outlines on dark surfaces
  primaryDark: '#1B3A2B',
  primaryLight: '#1F3B2C', // tinted green surface (selected card, soft buttons)
  accent: '#D0A85C',
  header: '#1B3A2B', // app bars + profile banner
  background: '#0F1613', // screen background
  surface: '#17211C', // cards, inputs, tab bar
  surfaceRaised: '#212E27', // toast and other floating elements
  border: '#2E4036',
  textPrimary: '#E8EFEA',
  textSecondary: '#AEBCB3',
  textMuted: '#8FA097',
  success: '#4FBF80',
  successBg: '#173726',
  danger: '#C93C36', // fill colour (white text on top = 5.0:1)
  dangerText: '#FF8F86', // red text / icons on dark surfaces
  dangerBg: '#3B1F1D',
  locked: '#93A199',
  lockedBg: '#222E27',
  lockedFill: '#4A5750', // disabled button fill (white text on top)
  white: '#FFFFFF',
};
