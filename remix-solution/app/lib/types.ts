export interface WordPressPost {
  id: string;
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  date: string;
  modified: string;
  categories: WordPressCategory[];
  featuredImage?: {
    url: string;
    alt: string;
  };
  author?: {
    name: string;
    avatar?: string;
  };
  seo: {
    title: string;
    metaDesc: string;
    canonical?: string;
  };
}

export interface WordPressCategory {
  name: string;
  slug: string;
}

export interface Rate {
  rate: number;
  date: string;
  duration: number; // in years
}

export interface TrustpilotReview {
  id: string;
  rating: number;
  title: string;
  content: string;
  author: string;
  date: string;
}

export interface ArticleStructuredData {
  "@context": "https://schema.org";
  "@type": "Article" | "BlogPosting";
  headline: string;
  datePublished: string;
  dateModified: string;
  author: {
    "@type": "Person";
    name: string;
  };
  publisher: {
    "@type": "Organization";
    name: string;
    logo: {
      "@type": "ImageObject";
      url: string;
    };
  };
  image?: string;
  description: string;
}
