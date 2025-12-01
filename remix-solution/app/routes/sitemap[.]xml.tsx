import type { LoaderFunctionArgs } from "@remix-run/node";
import { fetchWordPressPosts } from "~/lib/wordpress.server";
import { generateSitemapXML } from "~/lib/seo";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const posts = await fetchWordPressPosts();
  const sitemap = generateSitemapXML(posts);
  
  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
};
