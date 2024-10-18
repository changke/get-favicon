export interface Favicon {
  found: boolean; // favicon found in HTML via <link> element?
  href: string; // favicon URL
  type?: string; // mime type
  size?: number; // (square) size
  data?: string; // base64 image data
  cached?: boolean; // loaded from file cache?
  message?: string; // other messages e.g. network error present?
}
