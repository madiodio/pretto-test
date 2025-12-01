import type { WordPressPost } from "./types";

const WORDPRESS_API_URL = process.env.WORDPRESS_API_URL || "https://wordpress.org/news/wp-json/wp/v2";
const CACHE_TTL = 60 * 5; // 5 minutes

// Simple in-memory cache (in production, use Redis or similar)
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  
  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL * 1000) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Fetch WordPress posts with resilience:
 * - Returns cached data if API is down
 * - Logs errors instead of crashing
 * - Implements timeout
 */
export async function fetchWordPressPosts(): Promise<WordPressPost[]> {
  const cacheKey = "wordpress:posts";
  const cached = getCached<WordPressPost[]>(cacheKey);
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${WORDPRESS_API_URL}/posts?per_page=50&_embed`, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
      },
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`WordPress API returned ${response.status}`);
    }
    
    const data = await response.json();
    const posts = transformWordPressData(data);
    
    // Update cache on success
    setCache(cacheKey, posts);
    
    return posts;
  } catch (error) {
    console.error("WordPress fetch failed:", error);
    
    // Return stale cache if available (stale-while-revalidate pattern)
    if (cached) {
      console.warn("Using stale WordPress cache due to fetch error");
      return cached;
    }
    
    // Fallback: return empty array instead of crashing the build
    console.error("No cached data available, returning empty posts");
    return [];
  }
}

export async function fetchWordPressPostBySlug(slug: string): Promise<WordPressPost | null> {
  const cacheKey = `wordpress:post:${slug}`;
  const cached = getCached<WordPressPost>(cacheKey);
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(
      `${WORDPRESS_API_URL}/posts?slug=${slug}&_embed`,
      {
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
        },
      }
    );
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`WordPress API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      return null;
    }
    
    const posts = transformWordPressData(data);
    const post = posts[0];
    
    // Update cache
    setCache(cacheKey, post);
    
    return post;
  } catch (error) {
    console.error(`WordPress fetch failed for slug ${slug}:`, error);
    
    if (cached) {
      console.warn(`Using stale cache for post ${slug}`);
      return cached;
    }
    
    return null;
  }
}

/**
 * Transform WordPress REST API response to our internal format
 */
function transformWordPressData(data: any[]): WordPressPost[] {
  return data.map((item) => ({
    id: String(item.id),
    slug: item.slug,
    title: item.title?.rendered || "",
    content: item.content?.rendered || "",
    excerpt: item.excerpt?.rendered || "",
    date: item.date,
    modified: item.modified,
    categories: item._embedded?.["wp:term"]?.[0]?.map((cat: any) => ({
      name: cat.name,
      slug: cat.slug,
    })) || [],
    featuredImage: item._embedded?.["wp:featuredmedia"]?.[0]
      ? {
          url: item._embedded["wp:featuredmedia"][0].source_url,
          alt: item._embedded["wp:featuredmedia"][0].alt_text || "",
        }
      : undefined,
    author: item._embedded?.author?.[0]
      ? {
          name: item._embedded.author[0].name,
          avatar: item._embedded.author[0].avatar_urls?.["96"],
        }
      : undefined,
    seo: {
      title: item.yoast_head_json?.title || item.title?.rendered || "",
      metaDesc: item.yoast_head_json?.description || item.excerpt?.rendered || "",
      canonical: item.yoast_head_json?.canonical,
    },
  }));
}
