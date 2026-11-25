// Google sign-in for Drive backup.
// Paste the OAuth "Web application" Client ID from Google Cloud Console here
// (it is public information, not a secret). If left empty, it can also be
// pasted once in the app: Settings → Online backup → One-time setup.
export const GOOGLE_CLIENT_ID = '232554107525-bjdggdkl7uoddns5l41tqtu1p44bgc8d.apps.googleusercontent.com';

// Alarms when the app is closed: the address of the "bell" (bell/worker.js on Cloudflare).
// Set up once by the app owner (see bell/README.md), e.g. 'https://hp-bell.yourname.workers.dev'.
// Users then only tap "Turn on alarms". If empty, reminders ring only while the app is open.
export const BELL_URL = 'https://hp-bell.ilakkiyagpi.workers.dev';
