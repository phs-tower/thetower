/** @format */

import { article, spreads } from "@prisma/client";
import Head from "next/head";
import Link from "next/link";
import { getPublishedVanguardArticlesByIssue, getSpread } from "~/lib/queries";
import styles from "./spread.module.scss";
import { ReturnToCategoryButton } from "~/pages/articles/[year]/[month]/[cat]/[slug]";
import SpreadGallery from "~/components/spreadgallery.client";
import { displayDate, inferVanguardPageFromImageUrl } from "~/lib/utils";

interface Props {
	spread: spreads;
	relatedArticles: article[];
}

interface Params {
	params: {
		slug: string;
	};
}

export async function getServerSideProps({ params }: Params) {
	const spread = await getSpread(params.slug);
	if (!spread) return { notFound: true };

	return {
		props: {
			spread,
			relatedArticles: await getPublishedVanguardArticlesByIssue(spread.month, spread.year),
		},
	};
}

function getArticleHref(article: article) {
	return `/articles/${article.year}/${article.month}/${article.category}/${article.title.replaceAll(" ", "-").replaceAll(/[^0-9a-z\-]/gi, "")}-${
		article.id
	}`;
}

export function SpreadContent({ spread, relatedArticles }: Props) {
	const sortedRelatedArticles = [...relatedArticles].sort((a, b) => {
		const aPage = inferVanguardPageFromImageUrl(a.img) ?? Number.MAX_SAFE_INTEGER;
		const bPage = inferVanguardPageFromImageUrl(b.img) ?? Number.MAX_SAFE_INTEGER;
		if (aPage !== bPage) return aPage - bPage;
		return a.id - b.id;
	});

	return (
		<section className={styles["content"]}>
			<h1>{spread.title}</h1>
			<div className={styles["spread-gallery-wrapper"]}>
				<SpreadGallery spreadSrc={spread.src} />
			</div>
			{sortedRelatedArticles.length > 0 && (
				<section className={styles["issue-articles"]}>
					<div className={styles["issue-articles-header"]}>
						<h2>{`Articles From ${displayDate(spread.year, spread.month)}`}</h2>
						<p>Open the related Vanguard articles from this issue.</p>
					</div>
					<div className={styles["issue-articles-list"]}>
						{sortedRelatedArticles.map(article => {
							const pageNumber = inferVanguardPageFromImageUrl(article.img);
							return (
								<article key={article.id} className={styles["issue-article-card"]}>
									<div className={styles["issue-article-meta"]}>
										{pageNumber ? <span className={styles["issue-article-page"]}>{`Page ${pageNumber}`}</span> : null}
									</div>
									<h3>
										<Link href={getArticleHref(article)}>{article.title}</Link>
									</h3>
									{article.authors.length > 0 && <p className={styles["issue-article-authors"]}>{article.authors.join(" • ")}</p>}
								</article>
							);
						})}
					</div>
				</section>
			)}
		</section>
	);
}

export default function SpreadPage({ spread, relatedArticles }: Props) {
	return (
		<>
			<Head>
				<title>{`${spread.title} | The Tower`}</title>
				<meta property="og:title" content={`${spread.title} | The Tower`} />
				<meta property="og:description" content="Read more about this article!" />
			</Head>

			<ReturnToCategoryButton category="vanguard" />

			<SpreadContent spread={spread} relatedArticles={relatedArticles} />
		</>
	);
}
