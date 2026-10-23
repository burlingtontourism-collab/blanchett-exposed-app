const API_ENDPOINTS = [
  'https://blanchetexposed.wordpress.com/wp-json/wp/v2/posts?per_page=9&_fields=date,link,title,excerpt',
  'https://public-api.wordpress.com/rest/v1.1/sites/blanchetexposed.wordpress.com/posts/?number=9'
];

const articles = document.querySelector('#articles');
const status = document.querySelector('#status');

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

async function getPosts() {
  const errors = [];

  for (const endpoint of API_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const posts = Array.isArray(data) ? data : data.posts;

      if (!Array.isArray(posts)) throw new Error('Unexpected response format');

      return posts.map(normalizePost).filter(post => post.title && post.link);
    } catch (error) {
      errors.push(error.message);
      console.warn('WordPress feed endpoint failed:', endpoint, error);
    }
  }

  throw new Error(errors.join('; ') || 'No WordPress feed endpoint responded');
}

async function loadArticles() {
  status.textContent = 'Loading recent articles…';

  try {
    const posts = await getPosts();

    if (!posts.length) {
      articles.replaceChildren();
      status.textContent = 'No recent articles were returned. Open the full blog to browse all investigations.';
      return;
    }

    articles.replaceChildren(
      ...posts.map((post) => {
        const article = document.createElement('a');
        article.className = 'article';
        article.href = post.link;
        article.target = '_blank';
        article.rel = 'noopener noreferrer';

        const date = document.createElement('span');
        date.className = 'date';
        date.textContent = post.date
          ? new Intl.DateTimeFormat('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            }).format(new Date(post.date))
          : '';

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
    articles.replaceChildren();
    status.textContent = 'Recent articles could not load automatically. Please open the full blog to read the latest investigations.';
    console.error('Could not load WordPress posts from either feed:', error);
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
