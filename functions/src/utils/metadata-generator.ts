import { marked } from 'marked';

/**
 * Converts markdown text to HTML
 * @param markdown - The markdown string to convert
 * @returns HTML string
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) {
    return '';
  }

  return marked.parse(markdown) as string;
}

/**
 * Generates a URL-friendly slug from a title
 * @param title - The title to convert to a slug
 * @returns URL-friendly slug
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[äöüß]/g, (match) => {
      const umlautMap: Record<string, string> = {
        ä: 'ae',
        ö: 'oe',
        ü: 'ue',
        ß: 'ss',
      };
      return umlautMap[match] || match;
    })
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
