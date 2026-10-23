
const API = 'https://public-api.wordpress.com/wp/v2/sites/blanchetexposed.wordpress.com/posts?per_page=9&_fields=date,link,title,excerpt';

const articles = document.querySelector('#articles');
const status = document.querySelector('#status');

const plain = (value) => {
  const doc = new DOMParser().parseFromString(value || '', 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
};

async function loadArticles() {
  try {
    const response = await fetch(API);

    if (!response.ok) {
      throw new Error(`WordPress returned HTTP ${response.status}`);
    }

    const posts = await response.json();

    if (!Array.isArray(posts)) {
      throw new Error('WordPress response was not a list of posts');
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
        date.textContent = new Intl.DateTimeFormat('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        }).format(new Date(post.date));

        const heading = document.createElement('h3');
        heading.textContent = plain(post.title?.rendered);

        const excerpt = document.createElement('p');
        excerpt.className = 'excerpt';
        excerpt.textContent = plain(post.excerpt?.rendered).slice(0, 150);

        const read = document.createElement('span');
        read.className = 'read';
        read.textContent = 'Read investigation ↗';

        article.append(date, heading, excerpt, read);
        return article;
      })
    );

    status.textContent = posts.length
      ? 'Recent posts from Blanchett Exposed.'
      : 'No recent posts were returned. Open the full blog to browse all investigations.';
  } catch (error) {
    status.textContent = 'Recent articles could not load automatically. Open the full blog to read the latest investigations.';
    console.error('Could not load WordPress posts:', error);
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
