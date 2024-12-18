/**
 * @typedef {Object} Favicon
 * @property {boolean} found favicon found in HTML via <link> element?
 * @property {string} href
 * @property {string=} type mime-type
 * @property {number=} size (square) size
 * @property {string=} data base64 image data
 * @property {boolean=} cached loaded from file cache?
 * @property {string=} message other messages e.g. network error present?
 */

const selector = 'link[rel*="icon"][href]'; // will also match "apple-touch-icon" but okay

/**
 * Find favicons in HTML and extract them
 * @param {string} html
 * @param {DOMParser} domParser
 * @returns {Favicon[]}
 */
const extractFavicons = (html, domParser) => {
  /** @type {Favicon[]} */
  const icons = [];
  try {
    const doc = domParser.parseFromString(html, 'text/html');
    const links = doc.querySelectorAll(selector);
    console.log(`Found ${links.length} link element(s).`);
    links.forEach(link => {
      /** @type {Favicon} */
      const icon = {
        found: true,
        href: link.getAttribute('href') ?? '',
        type: link.getAttribute('type') ?? '',
        size: getIconSize(link.getAttribute('sizes') ?? '0')
      };
      icons.push(icon);
    });
    // Favicon not specified in HTML, take the fallback variant (domain/favicon.ico)
    if (icons.length === 0) {
      icons.push({
        found: false,
        href: '/favicon.ico'
      });
    }
    return icons;
  } catch (err) {
    console.error(err.message);
  }
};

/**
 * Get size of favicon from <link> element's sizes attribute
 * @param {string} sizes the size attribute
 * @returns {number}
 */
const getIconSize = sizes => {
  let s = 0;
  const p = sizes.split('x')[0];
  if (p) {
    s = parseInt(p);
    if (isNaN(s)) {
      s = 0;
    }
  }
  return s;
};

export default extractFavicons;
