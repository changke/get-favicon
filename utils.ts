import {DOMParser} from 'jsr:@b-fuze/deno-dom';
import type {Favicon} from "./types.ts";

const selector = 'link[rel*="icon"][href]'; // will also match "apple-touch-icon" but okay

/**
 * Extract favicon URLs from HTML using a DOM Parser implementation for Deno
 */
export const extractFavicons = (html: string): Favicon[] => {
  const icons: Favicon[] = [];
  try {
    const doc = (new DOMParser()).parseFromString(html, 'text/html');
    const links = doc.querySelectorAll(selector);
    console.log(`Found ${links.length} link element(s).`);
    links.forEach(link => {
      const icon: Favicon = {
        found: true,
        href: link.getAttribute('href') ?? '',
        type: link.getAttribute('type') ?? '',
        size: getIconSize(link.getAttribute('sizes') ?? '0')
      };
      icons.push(icon);
    });
  } catch (err) {
    console.error((err as Error).message);
  }
  // Favicon not specified in HTML, take the fallback variant (domain/favicon.ico)
  if (icons.length === 0) {
    icons.push({
      found: false,
      href: '/favicon.ico'
    });
  }
  return icons;
};

export const getIconSize = (sizes: string): number => {
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

/**
 * Choose the best bet
 * E.g. prefer SVG and large icon
 */
export const pickBestFavicon = (icons: Favicon[], hostDomain = ''): Favicon => {
  console.log(icons);
  let r;
  // 0. Only one...
  if (icons.length < 2) {
    r = icons[0];
  }
  // 1. Prefer SVG
  const svgIcons = icons.slice().filter(icon => icon.href.substring(icon.href.length - 4).toLowerCase() === '.svg');
  if (svgIcons.length > 0) {
    r = svgIcons[0];
  } else {
    // 2. Largest size
    const iconsCopy = icons.slice();
    iconsCopy.sort((a, b) => (b.size ?? 0) - (a.size ?? 0));
    r = Object.assign({}, iconsCopy[0]);
  }
  // Set Full URL
  if (hostDomain) {
    r.href = getIconUrl(r.href, hostDomain);
  }
  return r;
};

export const getIconUrl = (urlPath: string, hostDomain: string): string => {
  // if already absolute URL
  if (urlPath.startsWith('https://') && URL.canParse(urlPath)) {
    return urlPath;
  }
  // make full URL from relative URL
  try {
    const host = hostDomain.startsWith('https://') ? hostDomain : `https://${hostDomain}`;
    const urlObj = new URL(urlPath, host);
    return urlObj.href;
  } catch (err) {
    console.error(err);
    return '';
  }
};

/**
 * Set icon image as base64 string
 */
export const fillIconData = async (icon: Favicon): Promise<Favicon> => {
  const ico = Object.assign({}, icon);
  const iconUrl = ico.href;

  // default icon base64 string
  const defaultIconData = await convertBlobToBase64(await serveDefaultIconFile());
  ico.data = defaultIconData as string;
  // 1. icon href empty
  if (!iconUrl) {
    ico.message = 'No icon-URL found';
    return ico;
  }

  console.log(`Try fetching icon file ${iconUrl}...`);
  let resp;
  try {
    resp = await fetch(iconUrl);
    if (resp.ok) {
      // 2. fetch successful, use actual image string
      const blob = await resp.blob();
      ico.data = (await convertBlobToBase64(blob)) as string;
      return ico;
    } else {
      // 404
      if (resp.status === 404) {
        console.log('Icon file not found! Serving default...');
        ico.message = 'Icon href returns 404';
      } else {
        // other response issue
        console.log(`Fetching icon file not OK: ${resp.status} ${resp.statusText}`);
        ico.message = `Response not OK: ${resp.status} ${resp.statusText}`;
      }
      return ico;
    }
  } catch (err) {
    console.error(`Error fetching icon file: ${(err as Error).message}`);
    ico.message = 'Error fetching icon file';
    return ico;
  }
};

export const serveDefaultIconFile = async (): Promise<Blob> => {
  const file = 'rss_feed_orange_24dp.svg';
  const bytes = await Deno.readFile(file);
  const blob = new Blob([bytes], {type: 'image/svg+xml'});
  return blob;
};

// Fetch remote file as Blob -> base64 string
// https://gist.github.com/n1ru4l/dc99062577b746e0783410b1298ab897
export const convertBlobToBase64 = (blob: Blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
};

const iconDirName = 'icons';

export const getCachedFile = async (domain: string): Promise<string> => {
  const filePath = `${iconDirName}/${domain}.txt`;
  try {
    await Deno.lstat(filePath);
    // file exists
    const base64String = await Deno.readTextFile(filePath);
    return base64String;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      console.log('Icon cache file not found!');
    }
    return '';
  }
};

/**
 * Save stringified icon JSON into a text file for cache
 */
export const saveIconAsFile = async (icon: Favicon, domain: string) => {
  const filePath = `${iconDirName}/${domain}.txt`;
  try {
    await Deno.mkdir(iconDirName);
  } catch (err) {
    if (!(err instanceof Deno.errors.AlreadyExists)) {
      throw err;
    }
  } finally {
    const ico = Object.assign({}, icon);
    ico.cached = true;
    const fileContent = JSON.stringify(ico);
    await Deno.writeTextFile(filePath, fileContent);
  }
};
