const PAGE_SIZE = 9;
const SITE_URL = 'https://blanchett-exposed.pages.dev';
const FEED_URL = SITE_URL + '/articles/index.json';

const articles = document.querySelector('#articles');
const status = document.querySelector('#status');
const loadMoreButton = document.querySelector('#loadMore');
const archiveStatus = document.querySelector('#archiveStatus');
const searchForm = document.querySelector('#articleSearch');
const searchInput = document.querySelector('#searchInput');
const clearSearchButton = document.querySelector('#clearSearch');

let allArticles = [];
let visibleArticles = [];
let currentPage = 0;
let activeQuery = '';
let loading = false;

function plain(value) {
  const doc = new DOMParser().parseFromString(String(value || ''), 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

function safeHttpUrl(value, base = SITE_URL) {
  if (!value) return '';
  try {
    const url = new URL(value, base);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

function normalizeArticle(record) {
  if (!record || typeof record !== 'object') return null;
  const slug = String(record.slug || '').trim();
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) return null;

  const title = plain(record.title);
  if (!title) return null;

  const section = plain(record.section || 'Investigations');
  const excerpt = plain(record.excerpt);
  const image = safeHttpUrl(record.image || '');
  const tags = Array.isArray(record.topic_tags) ? record.topic_tags.map(plain).filter(Boolean) : [];

  return {
    slug,
    title,
    section,
    excerpt,
    date: String(record.date || ''),
    image,
    imageAlt: plain(record.image_alt || title),
    tags,
    link: SITE_URL + '/articles/' + encodeURIComponent(slug) + '/'
  };
}

async function fetchArchive() {
  const response = await fetch(FEED_URL, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error('The public website catalogue returned HTTP ' + response.status);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Unexpected public catalogue format');
  return data;
}

function formatDate(value) {
  if (!value) return '';
  const parsed = new Date(value + 'T12:00:00Z');
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(parsed);
}

function makeCard(post) {
  const article = document.createElement('a');
  article.className = 'article';
  article.href = post.link;
  article.target = '_blank';
  article.rel = 'noopener noreferrer';

  if (post.image) {
    const imageWrap = document.createElement('div');
    imageWrap.className = 'article-image-wrap';
    const image = document.createElement('img');
    image.className = 'article-image';
    image.src = post.image;
    image.alt = post.imageAlt;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => imageWrap.remove(), { once: true });
    imageWrap.append(image);
    article.append(imageWrap);
  }

  const copy = document.createElement('div');
  copy.className = 'article-copy';

  const meta = document.createElement('span');
  meta.className = 'date';
  const date = formatDate(post.date);
  meta.textContent = date ? post.section + ' · ' + date : post.section;

  const heading = document.createElement('h3');
  heading.textContent = post.title;

  const excerpt = document.createElement('p');
  excerpt.className = 'excerpt';
  excerpt.textContent = post.excerpt;

  const read = document.createElement('span');
  read.className = 'read';
  read.textContent = 'Read investigation ↗';

  copy.append(meta, heading, excerpt, read);
  article.append(copy);
  return article;
}

function updateArchiveControls() {
  if (!loadMoreButton) return;
  const hasMore = currentPage * PAGE_SIZE < visibleArticles.length;
  loadMoreButton.hidden = !hasMore;
  loadMoreButton.disabled = loading;
  loadMoreButton.textContent = loading ? 'Loading…' : 'Load older investigations';
  if (clearSearchButton) clearSearchButton.hidden = !activeQuery;
}

function renderNextPage(reset = false) {
  if (!articles) return;
  if (reset) {
    currentPage = 0;
    articles.replaceChildren();
  }

  const start = currentPage * PAGE_SIZE;
  const page = visibleArticles.slice(start, start + PAGE_SIZE);
  articles.append(...page.map(makeCard));
  currentPage += 1;

  if (!visibleArticles.length) {
    status.textContent = activeQuery
      ? 'No published investigations match “' + activeQuery + '”. Try another keyword.'
      : 'The published archive is temporarily unavailable.';
  } else {
    status.textContent = activeQuery
      ? 'Search results for “' + activeQuery + '”.'
      : 'Showing the latest published investigations.';
  }

  const shown = Math.min(currentPage * PAGE_SIZE, visibleArticles.length);
  archiveStatus.textContent = visibleArticles.length
    ? 'Showing ' + shown + ' of ' + visibleArticles.length + ' investigations.'
    : '';

  updateArchiveControls();
}

function applySearch() {
  const query = activeQuery.toLocaleLowerCase();
  visibleArticles = query
    ? allArticles.filter(article => [
        article.title, article.section, article.excerpt, ...article.tags
      ].join(' ').toLocaleLowerCase().includes(query))
    : allArticles.slice();

  renderNextPage(true);
}

async function start() {
  if (!articles || !status) return;
  loading = true;
  updateArchiveControls();
  status.textContent = 'Loading published investigations from the new website…';

  try {
    const records = await fetchArchive();
    allArticles = records.map(normalizeArticle).filter(Boolean);
    allArticles.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (!allArticles.length) throw new Error('The public article catalogue is empty.');
    applySearch();
  } catch (error) {
    console.error('Could not load the new Blanchett Exposed archive:', error);
    status.replaceChildren(document.createTextNode(
      'The new website archive could not be loaded automatically. '
    ));
    const link = document.createElement('a');
    link.href = SITE_URL + '/articles/';
    link.textContent = 'Open the complete Blanchett Exposed archive';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    status.append(link);
    archiveStatus.textContent = 'The reader is still available; use the website archive link above.';
  } finally {
    loading = false;
    updateArchiveControls();
  }
}

function startSearch(query) {
  activeQuery = String(query || '').trim();
  applySearch();
}

if (searchForm) {
  searchForm.addEventListener('submit', event => {
    event.preventDefault();
    startSearch(searchInput ? searchInput.value : '');
    articles?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

if (clearSearchButton) {
  clearSearchButton.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    startSearch('');
    searchInput?.focus();
  });
}

if (loadMoreButton) {
  loadMoreButton.addEventListener('click', () => {
    if (!loading && currentPage * PAGE_SIZE < visibleArticles.length) renderNextPage(false);
  });
}

const dismissButton = document.querySelector('#dismiss');
if (dismissButton) {
  dismissButton.addEventListener('click', () => {
    const installHelp = document.querySelector('#installHelp');
    if (installHelp) installHelp.hidden = true;
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(error => {
      console.warn('Reader offline support could not be registered:', error);
    });
  });
}

const notifyButton = document.querySelector('#notify');
const notifyOutput = document.querySelector('#notifyStatus');
const ONE_SIGNAL_APP_ID = '326ce20f-b4a3-47fb-8b80-dc878f7a3fd9';
let oneSignalReady = false;
let oneSignalInstance = null;
let oneSignalInitError = null;
let oneSignalInitStarted = false;

if (notifyButton && notifyOutput) {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async function (OneSignal) {
    oneSignalInitStarted = true;
    try {
      await OneSignal.init({
        appId: ONE_SIGNAL_APP_ID,
        serviceWorkerPath: '/blanchett-exposed-app/onesignal/OneSignalSDKWorker.js',
        serviceWorkerParam: { scope: '/blanchett-exposed-app/onesignal/' }
      });
      oneSignalInstance = OneSignal;
      oneSignalReady = true;
      notifyOutput.textContent = 'Ready. You can enable notifications for this device.';
    } catch (error) {
      console.error('OneSignal initialization failed:', error);
      oneSignalInitError = error && (error.message || String(error))
        ? (error.message || String(error))
        : 'The notification service could not initialize.';
      notifyOutput.textContent = 'Notifications are unavailable on this device right now. The reader and article archive remain available.';
    }
  });

  window.setTimeout(() => {
    if (!oneSignalReady && !oneSignalInitError && !oneSignalInitStarted) {
      oneSignalInitError = 'The OneSignal browser SDK did not start.';
      notifyOutput.textContent = 'Notifications are not ready yet. Please use the reader as usual.';
    } else if (!oneSignalReady && !oneSignalInitError && oneSignalInitStarted) {
      oneSignalInitError = 'OneSignal initialization timed out.';
      notifyOutput.textContent = 'Notifications are not ready yet. Please use the reader as usual.';
    }
  }, 15000);

  notifyButton.addEventListener('click', async () => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const missing = [];
    if (!('Notification' in window)) missing.push('Notification API');
    if (!('serviceWorker' in navigator)) missing.push('Service Worker API');
    if (!('PushManager' in window)) missing.push('Push API');

    if (missing.length) {
      notifyOutput.textContent = 'This browser does not support web push (' + missing.join(', ') + ').';
      return;
    }
    if (isIOS && !isInstalled) {
      notifyOutput.textContent = 'On iPhone, first open this page in Safari and choose Share → Add to Home Screen. Then open the installed reader.';
      return;
    }
    if (oneSignalInitError || !oneSignalReady || !oneSignalInstance) {
      notifyOutput.textContent = 'Notifications are not connected yet. You can continue reading the full archive here.';
      return;
    }

    notifyButton.disabled = true;
    try {
      await oneSignalInstance.Notifications.requestPermission();
      if (!oneSignalInstance.Notifications.permission) {
        notifyOutput.textContent = 'Browser permission was not granted. You can enable it later in your browser settings.';
        return;
      }
      await oneSignalInstance.User.PushSubscription.optIn();
      const subscription = oneSignalInstance.User.PushSubscription;
      if (subscription.optedIn && subscription.id) {
        notifyOutput.textContent = 'This device is subscribed. New article alerts will link to the Blanchett Exposed website.';
      } else {
        notifyOutput.textContent = 'Permission was granted, but the notification service has not confirmed this device yet. Try again in a moment.';
      }
    } catch (error) {
      console.error('Could not subscribe this device to notifications:', error);
      notifyOutput.textContent = 'The notification service could not complete setup. The article reader remains available.';
    } finally {
      notifyButton.disabled = false;
    }
  });
}

const backToTop = document.querySelector('#backToTop');
if (backToTop) {
  const updateBackToTop = () => {
    backToTop.classList.toggle('is-visible', window.scrollY > 300 || window.location.hash === '#articles');
  };
  window.addEventListener('scroll', updateBackToTop, { passive: true });
  window.addEventListener('hashchange', updateBackToTop);
  updateBackToTop();
  backToTop.addEventListener('click', event => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    history.replaceState(null, '', window.location.pathname + window.location.search);
  });
}

start();
