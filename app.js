const API_ENDPOINTS = [
  'https://public-api.wordpress.com/rest/v1.1/sites/blanchetexposed.wordpress.com/posts/?number=9',
  'https://blanchetexposed.wordpress.com/wp-json/wp/v2/posts?per_page=9&_fields=date,link,title,excerpt'
];

const articles = document.querySelector('#articles');
const status = document.querySelector('#status');
const BLOG_URL = 'https://blanchetexposed.wordpress.com/';

const plain = (value) => {
  const doc = new DOMParser().parseFromString(value || '', 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
};

function normalizePost(post) {
  return {
    date: post.date,
    link: post.link || post.URL,
    title: typeof post.title === 'string' ? post.title : post.title?.rendered,
    excerpt: typeof post.excerpt === 'string' ? post.excerpt : post.excerpt?.rendered
  };
}

async function getPosts() {
  const errors = [];

  for (const endpoint of API_ENDPOINTS) {
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

      const posts = records.map(normalizePost).filter(post => post.title && post.link);
      if (!posts.length) throw new Error('No published posts returned');

      return posts;
    } catch (error) {
      errors.push(error.message || String(error));
      console.warn('WordPress feed endpoint failed:', endpoint, error);
    }
  }

  throw new Error(errors.join('; ') || 'No WordPress feed endpoint responded');
}

function showBlogFallback(message) {
  articles.replaceChildren();
  status.replaceChildren(document.createTextNode(message + ' '));
  const link = document.createElement('a');
  link.href = BLOG_URL;
  link.textContent = 'Open Blanchett Exposed on WordPress';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  status.append(link);
}

async function loadArticles() {
  status.textContent = 'Loading recent articles…';

  try {
    const posts = await getPosts();

    articles.replaceChildren(
      ...posts.map((post) => {
        const article = document.createElement('a');
        article.className = 'article';
        article.href = post.link;
        article.target = '_blank';
        article.rel = 'noopener noreferrer';

        const date = document.createElement('span');
        date.className = 'date';
        if (post.date) {
          const parsedDate = new Date(post.date);
          date.textContent = Number.isNaN(parsedDate.getTime())
            ? ''
            : new Intl.DateTimeFormat('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              }).format(parsedDate);
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
      })
    );

    status.textContent = 'Recent posts from Blanchett Exposed.';
  } catch (error) {
    console.error('Could not load WordPress posts from either feed:', error);
    showBlogFallback('Recent articles could not load automatically.');
  }
}

loadArticles();

const dismissButton = document.querySelector('#dismiss');
if (dismissButton) {
  dismissButton.addEventListener('click', () => {
    const installHelp = document.querySelector('#installHelp');
    if (installHelp) installHelp.hidden = true;
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(console.warn);
  });
}

const notifyButton = document.querySelector('#notify');
if (notifyButton) {
  notifyButton.addEventListener('click', () => {
    const output = document.querySelector('#notifyStatus');
    if (!output) return;

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isInstalled =
      window.matchMedia('(display-mode: standalone)').matches ||
      navigator.standalone === true;

    if (
      !('Notification' in window) ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      output.textContent =
        'This browser does not support web push here. You can still follow the blog or subscribe by email.';
      return;
    }

    if (isIOS && !isInstalled) {
      output.textContent =
        'On iPhone, first open this site in Safari and choose Share → Add to Home Screen. Then open the installed app.';
      return;
    }

    output.textContent =
      'Browser support is available, but push is not configured yet. A push server and VAPID public key must be connected before subscriptions and automatic alerts can work.';
  });
}


const backToTop = document.querySelector('#backToTop');
if (backToTop) {
  const updateBackToTop = () => {
    backToTop.classList.toggle('is-visible', window.scrollY > 300);
  };
  window.addEventListener('scroll', updateBackToTop, { passive: true });
  updateBackToTop();
  backToTop.addEventListener('click', (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    history.replaceState(null, '', window.location.pathname + window.location.search);
  });
}
