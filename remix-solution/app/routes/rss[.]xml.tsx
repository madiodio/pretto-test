import type { LoaderFunctionArgs } from "@remix-run/node";
import { fetchWordPressPosts } from "~/lib/wordpress.server";
import { generateRSSFeed } from "~/lib/seo";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const posts = await fetchWordPressPosts();
  const rss = generateRSSFeed(posts);
  
  return new Response(rss, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
};
