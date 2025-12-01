import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { generateArticleSEO } from "~/lib/seo";
import { fetchWordPressPostBySlug } from "~/lib/wordpress.server";

export const loader = async ({ params }: LoaderFunctionArgs) => {
	const { slug } = params;

	if (!slug) {
		throw new Response("Not Found", { status: 404 });
	}

	const post = await fetchWordPressPostBySlug(slug);

	if (!post) {
		throw new Response("Not Found", { status: 404 });
	}

	const seoMetadata = generateArticleSEO(post);

	return json(
		{ post, seoMetadata },
		{
			headers: {
				// Cache for 5 minutes, stale-while-revalidate for 1 hour
				"Cache-Control":
					"public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
			},
		},
	);
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) {
		return [
			{ title: "Page non trouvée" },
			{ name: "robots", content: "noindex, nofollow" },
		];
	}

	const { seoMetadata } = data;

	return [
		{ title: seoMetadata.title },
		{
			name: "description",
			content: seoMetadata.description
				.replace(/<[^>]*>/g, "")
				.substring(0, 200),
		},
		{ name: "robots", content: seoMetadata.robots },
		{ tagName: "link", rel: "canonical", href: seoMetadata.canonical },

		// Open Graph
		{ property: "og:title", content: seoMetadata.openGraph.title },
		{
			property: "og:description",
			content: seoMetadata.openGraph.description
				.replace(/<[^>]*>/g, "")
				.substring(0, 200),
		},
		{ property: "og:url", content: seoMetadata.openGraph.url },
		{ property: "og:type", content: seoMetadata.openGraph.type },
		...(seoMetadata.openGraph.image
			? [{ property: "og:image", content: seoMetadata.openGraph.image }]
			: []),
		...(seoMetadata.openGraph.publishedTime
			? [
					{
						property: "article:published_time",
						content: seoMetadata.openGraph.publishedTime,
					},
				]
			: []),
		...(seoMetadata.openGraph.modifiedTime
			? [
					{
						property: "article:modified_time",
						content: seoMetadata.openGraph.modifiedTime,
					},
				]
			: []),
		...(seoMetadata.openGraph.author
			? [
					{
						property: "article:author",
						content: seoMetadata.openGraph.author,
					},
				]
			: []),

		// Twitter Card
		{ name: "twitter:card", content: seoMetadata.twitter.card },
		{ name: "twitter:title", content: seoMetadata.twitter.title },
		{
			name: "twitter:description",
			content: seoMetadata.twitter.description
				.replace(/<[^>]*>/g, "")
				.substring(0, 200),
		},
		...(seoMetadata.twitter.image
			? [{ name: "twitter:image", content: seoMetadata.twitter.image }]
			: []),
	];
};

export default function ArticlePage() {
	const { post, seoMetadata } = useLoaderData<typeof loader>();

	return (
		<article>
			{/* Structured Data (JSON-LD) */}
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(seoMetadata.structuredData),
				}}
			/>

			<header>
				<h1>{post.title}</h1>

				{post.author && (
					<div>
						<span>Par {post.author.name}</span>
					</div>
				)}

				<div>
					<time dateTime={new Date(post.date).toISOString()}>
						Publié le{" "}
						{new Date(post.date).toLocaleDateString("fr-FR", {
							year: "numeric",
							month: "long",
							day: "numeric",
						})}
					</time>
					{post.modified !== post.date && (
						<>
							{" • "}
							<time dateTime={new Date(post.modified).toISOString()}>
								Mis à jour le{" "}
								{new Date(post.modified).toLocaleDateString("fr-FR", {
									year: "numeric",
									month: "long",
									day: "numeric",
								})}
							</time>
						</>
					)}
				</div>

				{post.categories.length > 0 && (
					<div>
						{post.categories.map((category) => (
							<span key={category.slug}>{category.name}</span>
						))}
					</div>
				)}
			</header>

			{post.featuredImage && (
				<img
					src={post.featuredImage.url}
					alt={post.featuredImage.alt || post.title}
					loading="eager"
				/>
			)}

			<div dangerouslySetInnerHTML={{ __html: post.content }} />
		</article>
	);
}
