import {assertEquals} from "@std/assert";
import {extractFavicons, getIconSize, pickBestFavicon, getIconUrl} from "./utils.ts";
import type {Favicon} from "./types.ts";

const htmlFavIcon = (svg = true) => `<!DOCTYPE html>
  <html>
    <head>
      <title>Foo Bar</title>
      <link rel="stylesheet" href="/styles.css" />
      <link rel="icon" href="/favicon.png" sizes="32x32" type="image/png" />
      <link rel="icon" href="/img/favicon-16.ico" sizes="16x16" type="image/vnd.microsoft.icon" />
      <link rel="icon" href="/iphone.png" sizes="57x57" type="image/png" />
      ${svg ? '<link rel="icon" href="/gnome.svg" sizes="any" type="image/svg+xml" />' : ''}
    </head>
    <body></body>
  </html>
`;

const htmlNoFavIcon = `<!DOCTYPE html>
  <html>
    <head>
      <title>Bar Foo</title>
      <link rel="stylesheet" href="/styles.css" />
    </head>
    <body></body>
  </html>
`;

Deno.test('Got correct icon size', () => {
  const expectedIconSize = 48;
  assertEquals(getIconSize('48x48'), expectedIconSize);
});

Deno.test('Got fallback icon size too', () => {
  assertEquals(getIconSize('any'), 0);
  assertEquals(getIconSize('0'), 0);
});

Deno.test('Found 1st icon', () => {
  const firstIcon: Favicon = {
    found: true,
    href: '/favicon.png',
    type: 'image/png',
    size: 32
  };
  const foundIcons = extractFavicons(htmlFavIcon());
  assertEquals(foundIcons[0], firstIcon);
});

Deno.test('Can get fallback icon', () => {
  const fallbackIconExpected: Favicon = {
    found: false,
    href: '/favicon.ico'
  };
  const fallbackIconActual = extractFavicons(htmlNoFavIcon);
  assertEquals(fallbackIconActual[0], fallbackIconExpected);
});

Deno.test('Can get the best icon (with SVG)', () => {
  const expectedBestIcon: Favicon = {
    found: true,
    href: '/gnome.svg',
    type: 'image/svg+xml',
    size: 0
  };
  assertEquals(pickBestFavicon(extractFavicons(htmlFavIcon())), expectedBestIcon);
});

Deno.test('Can get the best icon (without SVG)', () => {
  const expected: Favicon = {
    found: true,
    href: '/iphone.png',
    type: 'image/png',
    size: 57
  };
  assertEquals(pickBestFavicon(extractFavicons(htmlFavIcon(false))), expected);
});

Deno.test('Can get full file URL', () => {
  const filePath = '/static/favicon.svg';
  const hostDomain = 'example.com';
  assertEquals(getIconUrl(filePath, hostDomain), 'https://example.com/static/favicon.svg');
});
