const PAGE_SIZE = 9;
const WORDPRESS_API = 'https://public-api.wordpress.com/rest/v1.1/sites/blanchetexposed.wordpress.com/posts/';
const WP_REST_API = 'https://blanchetexposed.wordpress.com/wp-json/wp/v2/posts';
const articles = document.querySelector('#articles');
const status = document.querySelector('#status');
const loadMoreButton = document.querySelector('#loadMore');
const archiveStatus = document.querySelector('#archiveStatus');
const searchForm = document.querySelector('#articleSearch');
const searchInput = document.querySelector('#searchInput');
const clearSearchButton = document.querySelector('#clearSearch');
const BLOG_URL = 'https://blanchetexposed.wordpress.com/';
let currentPage = 1;
let loading = false;
let finished = false;
let activeQuery = '';
let seenLinks = new Set();

const plain = (value) => {
  const doc = new DOMParser().parseFromString(value || '', 'text/html');
  return (doc.body.textContent || '').replace(/\\s+/g, ' ').trim();
};

function normalizePost(post) {
  return {
    date: post.date,
    link: post.link || post.URL,
    title: typeof post.title === 'string' ? post.title : post.title?.rendered,
    excerpt: typeof post.excerpt === 'string' ? post.excerpt : post.excerpt?.rendered
  };
}

async function fetchPage(page, query = '') {
  const search = query ? '&search=' + encodeURIComponent(query) : '';
  const endpoints = [
    WORDPRESS_API + '?number=' + PAGE_SIZE + '&page=' + page + search,
    WP_REST_API + '?per_page=' + PAGE_SIZE + '&page=' + page + '&_fields=date,link,title,excerpt' +
      (query ? '&search=' + encodeURIComponent(query) : '')
  ];
  const errors = [];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      const records = Array.isArray(data) ? data : data.posts;
      if (!Array.isArray(records)) throw new Error('Unexpected response format');
      return records.map(normalizePost).filter(post => post.title && post.link);
    } catch (error) {
      errors.push(error.message || String(error));
      console.warn('WordPress archive endpoint failed:', endpoint, error);
    }
  }
  throw new Error(errors.join('; ') || 'No WordPress archive endpoint responded');
}

function makeCard(post) {
  const article = document.createElement('a');
  article.className = 'article';
  article.href = post.link;
  article.target = '_blank';
  article.rel = 'noopener noreferrer';

  const date = document.createElement('span');
  date.className = 'date';
  if (post.date) {
    const parsedDate = new Date(post.date);
    date.textContent = Number.isNaN(parsedDate.getTime()) ? '' :
      new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsedDate);
  }
  const heading = document.createElement('h3');
  heading.textContent = plain(post.title);
  const excerpt = document.createElement('p');
  excerpt.className = 'excerpt';
  excerpt.textContent = plain(post.excerpt).slice(0, 150);
  const read = document.createElement('span');
  read.className = 'read';
  read.textContent = 'Read investigation ↗';
  article.append(date, heading, excerpt, read);
  return article;
}

function updateArchiveControls() {
  if (!loadMoreButton) return;
  loadMoreButton.hidden = finished;
  loadMoreButton.disabled = loading;
  loadMoreButton.textContent = loading ? 'Loading…' :
    (activeQuery ? 'Load more search results' : 'Load older investigations');
  if (clearSearchButton) clearSearchButton.hidden = !activeQuery;
}

async function loadPage(page, append = false) {
  if (loading || (finished && append)) return;
  loading = true;
  updateArchiveControls();
  if (archiveStatus) archiveStatus.textContent = append
    ? (activeQuery ? 'Loading more search results…' : 'Loading older investigations…')
    : '';
  if (!append) status.textContent = activeQuery
    ? 'Searching the published archive…'
    : 'Loading recent articles…';

  try {
    const posts = await fetchPage(page, activeQuery);
    const freshPosts = posts.filter(post => !seenLinks.has(post.link));
    freshPosts.forEach(post => seenLinks.add(post.link));
    if (!append) articles.replaceChildren();
    articles.append(...freshPosts.map(makeCard));
    currentPage = page;

    if (!freshPosts.length && !append) {
      status.textContent = activeQuery
        ? 'No articles found for “' + activeQuery + '”. Try another keyword.'
        : 'No articles are available right now.';
    } else if (activeQuery) {
      status.textContent = 'Search results for “' + activeQuery + '”.';
    } else {
      status.textContent = 'Recent posts from Blanchett Exposed.';
    }

    finished = posts.length < PAGE_SIZE || (append && freshPosts.length === 0);
    if (finished && archiveStatus) {
      archiveStatus.textContent = activeQuery
        ? 'You’ve reached the end of these search results.'
        : 'You’re viewing all posts available through the public feed.';
    } else if (archiveStatus) {
      archiveStatus.textContent = '';
    }
  } catch (error) {
    console.error('Could not load WordPress archive:', error);
    if (!append) {
      status.replaceChildren(document.createTextNode(
        activeQuery ? 'Search is temporarily unavailable. ' : 'Recent articles could not load automatically. '
      ));
      const link = document.createElement('a');
      link.href = BLOG_URL;
      link.textContent = 'Open Blanchett Exposed on WordPress';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      status.append(link);
    } else if (archiveStatus) {
      archiveStatus.textContent = 'Could not load more posts just now. Please try again.';
    }
  } finally {
    loading = false;
    updateArchiveControls();
  }
}

function startSearch(query) {
  activeQuery = query.trim();
  currentPage = 1;
  finished = false;
  seenLinks = new Set();
  if (archiveStatus) archiveStatus.textContent = '';
  updateArchiveControls();
  loadPage(1, false);
  document.querySelector('#articles')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

if (searchForm) {
  searchForm.addEventListener('submit', event => {
    event.preventDefault();
    startSearch(searchInput.value);
  });
}
if (clearSearchButton) {
  clearSearchButton.addEventListener('click', () => {
    searchInput.value = '';
    startSearch('');
    searchInput.focus();
  });
}
if (loadMoreButton) loadMoreButton.addEventListener('click', () => loadPage(currentPage + 1, true));
loadPage(1, false);

const dismissButton = document.querySelector('#dismiss');
if (dismissButton) dismissButton.addEventListener('click', () => {
  const installHelp = document.querySelector('#installHelp');
  if (installHelp) installHelp.hidden = true;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.warn));
}

const notifyButton = document.querySelector('#notify');
const notifyOutput = document.querySelector('#notifyStatus');
let oneSignalReady = false;
let oneSignalInstance = null;

if (notifyButton && notifyOutput) {
  notifyButton.textContent = 'Enable notifications';
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async function (OneSignal) {
    try {
      await OneSignal.init({
        appId: '326ce20f-b4a3-47fb-8b80-dc878f7a3fd9',
        serviceWorkerPath: '/blanchett-exposed-app/sw.js',
        serviceWorkerParam: { scope: '/blanchett-exposed-app/' }
      });
      oneSignalInstance = OneSignal;
      oneSignalReady = true;
      notifyOutput.textContent = 'Ready to enable push notifications on this device.';
    } catch (error) {
      console.error('OneSignal initialization failed:', error);
      notifyOutput.textContent = 'Notifications could not initialize. Please refresh this page and try again. If it continues, the site setup needs further fixing.';
    }
  });

  notifyButton.addEventListener('click', async () => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      notifyOutput.textContent = 'This browser does not support web push here. You can still read the blog on WordPress.';
      return;
    }
    if (isIOS && !isInstalled) {
      notifyOutput.textContent = 'On iPhone, first open this site in Safari and choose Share → Add to Home Screen. Then open the installed app.';
      return;
    }
    if (!oneSignalReady || !oneSignalInstance) {
      notifyOutput.textContent = 'The notification service is still loading. Please wait a moment and try again.';
      return;
    }
    try {
      await oneSignalInstance.Notifications.requestPermission();
      notifyOutput.textContent = oneSignalInstance.Notifications.permission
        ? 'Notifications are enabled for this device. We will test automatic article alerts once the OneSignal setup is complete.'
        : 'Notifications were not enabled. You can allow them in your browser settings and try again.';
    } catch (error) {
      console.error('Could not request notification permission:', error);
      notifyOutput.textContent = 'Could not enable notifications. Check this site’s notification permission in your browser settings.';
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
