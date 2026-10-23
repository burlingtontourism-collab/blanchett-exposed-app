# Blanchett Exposed — PWA starter

A first installable-web-app prototype for Android and iPhone. It has an editorial design, loads recent public posts from the WordPress.com REST API, includes a web app manifest and service worker, and contains a push-event handler.

## Important: push notifications are NOT active yet
This static prototype cannot register subscriptions or send real push notifications until a push backend is configured. Real web push needs:
1. HTTPS hosting.
2. A VAPID key pair.
3. A server endpoint to receive/store reader subscriptions.
4. Server-side code that encrypts and sends push messages.
5. An automation that detects new WordPress posts and triggers the sender.

Never put a VAPID private key or service secret in `app.js`.

## WordPress.com compatibility
WordPress.com Free restricts third-party plugins and custom JavaScript. This app is designed to be hosted separately on a free static HTTPS host and linked from the blog. The original articles remain on WordPress.com.

## Article feed
The app reads:
`https://blanchetexposed.wordpress.com/wp-json/wp/v2/posts?per_page=9&_fields=date,link,title,excerpt`

If the API request is blocked or unavailable, the app still links readers to the main blog.

## Free static hosting
One possible route is GitHub Pages:
1. Create a repository and upload all files from this folder.
2. In repository Settings → Pages, enable deployment from the `main` branch and root folder.
3. Open the generated HTTPS URL on a phone.
4. Android users can choose Install/Add to Home Screen. On iPhone, open in Safari and choose Share → Add to Home Screen.

## iPhone push requirements
Web push on iPhone/iPad requires iOS/iPadOS 16.4 or later and the app added to the Home Screen. Readers must explicitly grant permission. The server side must also be configured before any push alert will be delivered.

## Privacy
This prototype does not store email addresses or notification subscriptions. Add a clear privacy notice if push is enabled later.
