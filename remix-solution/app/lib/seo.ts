import type { WordPressPost, ArticleStructuredData } from "./types";

const SITE_URL = "https://wordpress.org/news";
const SITE_NAME = "WordPress News";
const PUBLISHER_LOGO = "https://s.w.org/style/images/about/WordPress-logotype-wmark.png";

export interface SEOMetadata {
  title: string;
  description: string;
  canonical: string;
  openGraph: {
    title: string;
    description: string;
    url: string;
    type: "article";
    image?: string;
    publishedTime?: string;
    modifiedTime?: string;
    author?: string;
  };
  twitter: {
    card: "summary_large_image";
    title: string;
    description: string;
    image?: string;
  };
  structuredData: ArticleStructuredData;
  robots?: string;
}

/**
 * Generate complete SEO metadata for an article
 */
export function generateArticleSEO(post: WordPressPost): SEOMetadata {
  const url = `${SITE_URL}/actualites/${post.slug}`;
  const title = post.seo.title || post.title;
  const description = post.seo.metaDesc || post.excerpt.replace(/<[^>]*>/g, "").substring(0, 160);
  
  // Use canonical from WordPress if valid, otherwise generate our own
  const canonical = isValidCanonical(post.seo.canonical) 
    ? post.seo.canonical 
    : url;
  
  // Ensure dates are in ISO 8601 format
  const datePublished = ensureISO8601(post.date);
  const dateModified = ensureISO8601(post.modified);
  
  return {
    title,
    description,
    canonical,
    openGraph: {
      title,
      description,
      url,
      type: "article",
      image: post.featuredImage?.url,
      publishedTime: datePublished,
      modifiedTime: dateModified,
      author: post.author?.name,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      image: post.featuredImage?.url,
    },
    structuredData: {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: title,
      datePublished,
      dateModified,
      author: {
        "@type": "Person",
        name: post.author?.name || "Équipe Pretto",
      },
      publisher: {
        "@type": "Organization",
        name: SITE_NAME,
        logo: {
          "@type": "ImageObject",
          url: PUBLISHER_LOGO,
        },
      },
      image: post.featuredImage?.url,
      description,
    },
    robots: "index, follow",
  };
}

/**
 * Validate that a canonical URL is well-formed and points to our domain
 */
function isValidCanonical(canonical: string | undefined): canonical is string {
  if (!canonical) return false;
  
  try {
    const url = new URL(canonical);
    // Only accept canonicals from our own domain
    return url.hostname === "wordpress.org";
  } catch {
    return false;
  }
}

/**
 * Ensure date is in ISO 8601 format
 * WordPress typically returns ISO 8601, but this ensures consistency
 */
function ensureISO8601(date: string): string {
  try {
    return new Date(date).toISOString();
  } catch {
    console.warn(`Invalid date format: ${date}, using current date`);
    return new Date().toISOString();
  }
}

/**
 * Generate sitemap XML for posts
 */
export function generateSitemapXML(posts: WordPressPost[]): string {
  const urls = posts.map((post) => {
    const url = `${SITE_URL}/actualites/${post.slug}`;
    const lastmod = ensureISO8601(post.modified);
    
    return `  <url>
    <loc>${escapeXML(url)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
  }).join("\n");
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

/**
 * Generate RSS feed for posts
 */
export function generateRSSFeed(posts: WordPressPost[]): string {
  const items = posts.slice(0, 20).map((post) => {
    const url = `${SITE_URL}/actualites/${post.slug}`;
    const pubDate = new Date(post.date).toUTCString();
    
    return `    <item>
      <title>${escapeXML(post.title)}</title>
      <link>${escapeXML(url)}</link>
      <guid>${escapeXML(url)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXML(post.excerpt.replace(/<[^>]*>/g, "").substring(0, 200))}</description>
    </item>`;
  }).join("\n");
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Pretto - Actualités Immobilier</title>
    <link>${SITE_URL}/actualites</link>
    <description>Toute l'actualité du crédit immobilier et de l'immobilier par Pretto</description>
    <language>fr-FR</language>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
}

/**
 * Properly escape XML special characters
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
