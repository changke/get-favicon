import {Hono} from '@hono/hono';
import type {Favicon} from "./types.ts";
import {pickBestFavicon, extractFavicons, convertBlobToBase64, getCachedFile, saveIconAsFile, serveDefaultIconFile, fillIconData} from './utils.ts';
import puppeteer from 'puppeteer';

/**
 * Get the domain name from URL (ignore URL path)
 */
const getHostDomain = (url: string): string => {
  let u = url;
  if (!u.startsWith('https://')) {
    u = `https://${u}`;
  }
  if (!URL.canParse(u)) {
    return '';
  } else {
    const urlObj = new URL(u);
    return `https://${urlObj.hostname}`;
  }
};

const demoHtml = (icon: Favicon) => `<!DOCTYPE html>
  <html>
    <head>
      <title>Get Favicon Demo</title>
    </head>
    <body>
      <pre><code>${JSON.stringify(icon, null, 2)}</code></pre>
      <img alt="Icon" src="${icon.data}" />
    </body>
  </html>
`;

// Setup Puppeteer
const browser = await puppeteer.launch();
const page = await browser.newPage();

page.on('console', msg => console.info(msg.text()));

await page.goto('about:blank');
console.log('Puppeteer started.');

await page.exposeFunction('readTextFile', async (filePath: string) => {
  try {
    const c = await Deno.readTextFile(filePath);
    return c;
  } catch (err) {
    console.error((err as Error).message);
  }
});

const puppeteerEval = async (html: string) => {
  console.log('Calling pptr-js-eval()...');
  // @ts-ignore: puppeteer
  const result = await page.evaluate(async htmlSrc => {
    console.log('Inside pptr-js-eval()...');
    // @ts-ignore: puppeteer
    const funcSrc = await window.readTextFile('./extractor.js');
    // @ts-ignore: puppeteer
    const func = (await import(`data:text/javascript,${funcSrc}`)).default;
    return func(htmlSrc, new DOMParser());
  }, html);
  return result as Favicon[];
};

const app = new Hono();

app.get('/', ctx => {
  return ctx.text('Get Favicon, try "/at/deno.com"');
});

app.get('/list', async ctx => {
  const dir = 'icons';
  const files = [];
  try {
    for await (const dirEntry of Deno.readDir(dir)) {
      files.push(dirEntry.name);
    }
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      files.push('Directory not found!');
    } else {
      files.push('Unknown error!');
    }
  }
  return ctx.text(files.sort().join('\n'));
});

const fallbackIcon = async (message: string): Promise<Favicon> => {
  const b64Str = await convertBlobToBase64(await serveDefaultIconFile());
  return {
    found: false,
    href: '',
    type: 'image/svg+xml',
    data: b64Str as string,
    cached: false,
    message: message
  };
};

const getTheIcon = async (domain: string, handler: 'deno' | 'pptr' = 'pptr'): Promise<Favicon> => {
  const hostDomain = getHostDomain(domain);
  let theIcon;
  if (hostDomain) {
    // 1. check file system for cached icon data
    const cachedContent = await getCachedFile(domain);
    if (cachedContent) {
      console.log('Using cached file.');
      return JSON.parse(cachedContent) as Favicon;
    }

    // 2. Fetch icon from remote host
    // fetch the HTML
    try {
      const resp = await fetch(hostDomain);
      if (!resp.ok) {
        theIcon = await fallbackIcon(`Fetching HTML response not OK! ${resp.status} ${resp.statusText}`);
      } else {
        const html = await resp.text();
        // extract favicons
        const icons = (handler === 'deno') ? extractFavicons(html) : await puppeteerEval(html);
        // pick the best icon
        let bestIcon = pickBestFavicon(icons, hostDomain);
        // set icon image
        bestIcon = await fillIconData(bestIcon);

        // 3. Save cache
        await saveIconAsFile(bestIcon, domain);

        // set return value
        theIcon = bestIcon;
      }
    } catch (err) {
      theIcon = await fallbackIcon(`Getting favicon error: ${(err as Error).message}`);
    }
    return theIcon;
  } else {
    theIcon = await fallbackIcon('Domain name cannot be parsed!');
    return theIcon;
  }
};

app.get('/at/:domain', async ctx => {
  const domain = ctx.req.param('domain');
  const theIcon = await getTheIcon(domain);
  if (theIcon) {
    return ctx.text((theIcon as Favicon).data ?? '');
  } else {
    return ctx.notFound();
  }
});

app.get('demo/:domain', async ctx => {
  const domain = ctx.req.param('domain');
  const theIcon = await getTheIcon(domain);
  if (theIcon) {
    return ctx.html(demoHtml(theIcon));
  } else {
    return ctx.notFound();
  }
});

Deno.addSignalListener("SIGINT", async () => {
  await browser.close();
  console.log('Puppeteer browser closed. Exiting...');
  Deno.exit();
});

Deno.serve(app.fetch);
console.log('Server started.');
