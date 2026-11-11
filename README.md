# Blanchett Exposed — mobile reader

The repository hosts the installable mobile reader at:

- https://burlingtontourism-collab.github.io/blanchett-exposed-app/
- Installation guide: https://burlingtontourism-collab.github.io/blanchett-exposed-app/install.html

The reader is a Progressive Web App (PWA), installed from Chrome on Android or Safari on iPhone. It is not a native APK or an App Store / Google Play listing.

## Current website integration

The reader now loads its published catalogue from the new Blanchett Exposed website repository:

- Public catalogue source: `public/articles/index.json`
- Article pages: `https://blanchett-exposed.pages.dev/articles/<slug>/`
- Images: served from the new website's `/assets/images/` paths

It does not use WordPress as its article feed or send readers to the former WordPress site.

The root repository for the publication is `burlingtontourism-collab/blanchett-exposed`. If that website changes its catalogue format, update and test `app.js` accordingly.

## Installation and QR

Keep `install.html` at its existing URL. The QR code on the new magazine website points to this address; changing it would break printed or saved QR codes.

The PWA icons use the black-and-gold BE monogram from the new website's favicon. The manifest and service worker must be updated together when app assets change.

## Notifications

OneSignal browser push is configured in `app.js` and uses the worker files in `onesignal/`. The scheduled GitHub Actions workflow checks the new website's public article catalogue and sends alerts that link to the new website. The repository secret `ONESIGNAL_REST_API_KEY` is required for sending.

A successful browser subscription does not by itself prove delivery; test an actual device notification from OneSignal before announcing push alerts as fully operational.

## Privacy

The reader does not request a reader's identity or email address. Push notifications are optional and require explicit browser permission.
