/** @format */
/* eslint-disable @next/next/no-img-element */

import Head from "next/head";
import Image from "next/image";
import { article, spreads } from "@prisma/client";
import { GetStaticPaths, GetStaticProps } from "next";
import { getArticle, getSpreadByIssue } from "~/lib/queries";
import { displayDate, getSpreadPageImageUrl, inferVanguardPageFromImageUrl, parseSpreadSource } from "~/lib/utils";
import CreditLink from "~/components/credit.client";
import { remark } from "remark";
import html from "remark-html";
import SubBanner from "~/components/subbanner.client";
import PhotoCredit from "~/components/photocredit";
import Link from "next/link";
import { PdfPageThumbnail } from "~/components/pdfspreadfallback.client";
import { ParsedUrlQuery } from "querystring";

import articleStyles from "./article.module.scss";

interface Props {
	article: article;
	mainSpread: spreads | null;
}

interface ArticleContentProps {
	article: article;
	showColumnAd?: boolean;
}

const ARTICLE_COLUMN_AD = {
	src: "/assets/fledermaus-article-column-2026.jpg",
	href: "https://www.thestateoperanj.org/",
	alt: "Die Fledermaus 2026 presented by The State Opera of New Jersey",
	width: 1224,
	height: 2000,
};

interface Params extends ParsedUrlQuery {
	year: string;
	month: string;
	cat: string;
	slug: string;
}

export const getStaticPaths: GetStaticPaths<Params> = async () => ({
	paths: [],
	fallback: "blocking",
});

export const getStaticProps: GetStaticProps<Props, Params> = async ({ params }) => {
	if (!params) return { notFound: true };

	const article_id = params.slug.split("-").slice(-1)[0];

	let raw: article | null = null; // equivalent to prior but explicit

	if (isNaN(Number(article_id))) raw = await getArticle(params.year, params.month, params.cat, "null", params.slug);
	else raw = await getArticle(params.year, params.month, params.cat, article_id, params.slug);

	if (!raw) return { notFound: true, revalidate: 60 };

	const processedArticle: article = raw;

	if (processedArticle.markdown) {
		const marked = await remark().use(html).process(processedArticle.content);
		processedArticle.content = marked.toString();
	}

	const mainSpread =
		processedArticle.category === "vanguard" && ["articles", "random-musings"].includes(processedArticle.subcategory)
			? await getSpreadByIssue("vanguard", processedArticle.month, processedArticle.year)
			: null;

	return { props: { article: processedArticle, mainSpread }, revalidate: 60 };
};

export function ReturnToCategoryButton({ category }: { category: string }) {
	const categoryLabels: { [key: string]: string } = {
		"news-features": "NEWS & FEATURES",
		opinions: "OPINIONS",
		vanguard: "VANGUARD",
		sports: "SPORTS",
		"arts-entertainment": "ARTS & ENTERTAINMENT",
		crossword: "CROSSWORD",
	};
	return (
		// Animate the return to category button a bit more nicely
		<div className={articleStyles["return-to-category-container"]}>
			<Link href={`/category/${category}`} className={articleStyles["return-to-category"]}>
				{categoryLabels[category] || category.toUpperCase()} <i className="fa-solid fa-arrow-up"></i>
			</Link>
		</div>
	);
}

export function ArticleContent({ article, showColumnAd = true }: ArticleContentProps) {
	return (
		<section className={articleStyles["content"]}>
			<div className={articleStyles["titleblock"]}>
				<h1>{article.title}</h1>

				<span className={articleStyles["date"]}>{displayDate(article.year, article.month)}</span>
				{article.authors.length > 0 && (
					<section className={articleStyles["authors"]}>
						{article.authors.map((author, index) => (
							<span key={index}>
								<CreditLink author={author} />
								{index < article.authors.length - 1 && <span style={{ margin: "0 5px" }}>•</span>}
							</span>
						))}
					</section>
				)}
			</div>

			<br />
			<br />

			<div>
				{article.img && (
					<>
						<Image
							src={article.img}
							width={1000}
							height={1000}
							alt={article.contentInfo ?? ""}
							priority
							sizes="(max-width: 900px) 100vw, 72rem"
						/>
						{article.contentInfo && <PhotoCredit contentInfo={article.contentInfo} />}
					</>
				)}
			</div>

			<div className={articleStyles["article-body"]}>
				{article.markdown ? (
					<div className={articleStyles["main-article"]} dangerouslySetInnerHTML={{ __html: article.content }} />
				) : (
					<div className={articleStyles["main-article"]}>
						<LegacyArticleContent article={article} />
					</div>
				)}

				{showColumnAd && (
					<aside className={articleStyles["article-column-ad"]} aria-label="Article sponsor">
						<div className={articleStyles["article-column-ad-label"]}>ADVERTISEMENT</div>
						<a href={ARTICLE_COLUMN_AD.href} target="_blank" rel="noreferrer" className={articleStyles["article-column-ad-image-link"]}>
							<Image
								src={ARTICLE_COLUMN_AD.src}
								alt={ARTICLE_COLUMN_AD.alt}
								width={ARTICLE_COLUMN_AD.width}
								height={ARTICLE_COLUMN_AD.height}
								sizes="(max-width: 900px) 100vw, (max-width: 1279px) 22rem, 30rem"
							/>
						</a>
						<div className={articleStyles["article-column-ad-caption"]}>
							<a
								href={ARTICLE_COLUMN_AD.href}
								target="_blank"
								rel="noreferrer"
								className={articleStyles["article-column-ad-caption-link"]}
							>
								Die Fledermaus 2026 presented by The State Opera of New Jersey
							</a>
						</div>
					</aside>
				)}
			</div>
		</section>
	);
}

function getSpreadHref(spread: spreads) {
	return `/spreads/${spread.year}/${spread.month}/vanguard/${encodeURI(spread.title)}`;
}

function VanguardSpreadCard({ article, spread }: { article: article; spread: spreads | null }) {
	if (!spread) return null;

	const pageNumber = inferVanguardPageFromImageUrl(article.img);
	const spreadHref = getSpreadHref(spread);
	const { pageCount, pdfUrl } = parseSpreadSource(spread.src);

	return (
		<section className={articleStyles["related-spread-section"]}>
			<div className={articleStyles["related-spread-header"]}>
				<span className={articleStyles["related-spread-eyebrow"]}>Main Spread</span>
				<h2>Open the full Vanguard spread</h2>
				<p>{`Read the rest of ${displayDate(spread.year, spread.month)}'s Vanguard issue.`}</p>
			</div>

			<Link href={spreadHref} className={articleStyles["related-spread-card"]}>
				<div className={articleStyles["related-spread-thumb"]}>
					{pageCount > 0 ? (
						<img src={getSpreadPageImageUrl(spread.src, 1)} alt={`${spread.title} preview`} />
					) : pdfUrl ? (
						<PdfPageThumbnail pdfUrl={pdfUrl} alt={`${spread.title} preview`} />
					) : (
						<div className={articleStyles["related-spread-thumb-fallback"]}>Preview unavailable</div>
					)}
				</div>

				<div className={articleStyles["related-spread-copy"]}>
					{pageNumber ? <span className={articleStyles["related-spread-page"]}>{`This article appears on page ${pageNumber}`}</span> : null}
					<h3>{spread.title}</h3>
					<p className={articleStyles["related-spread-meta"]}>{displayDate(spread.year, spread.month)}</p>
					<span className={articleStyles["related-spread-cta"]}>Open main spread</span>
				</div>
			</Link>
		</section>
	);
}
/**
 * Generate HTML for the old (pre-md) article format
 *
 * The old format is quite literally just paragraphs separated by new lines with `@img=[url]` for images
 * At some point we should probs migrate all the old articles but 🤷‍♂️
 */
function LegacyArticleContent({ article }: { article: article }) {
	return (
		<>
			{article.content.split("\n").map((paragraph, index) => {
				if (paragraph.startsWith("@img=")) {
					const src = paragraph.substring(5).trim();
					if (!src) return null;

					return <Image key={index} src={src} width={1000} height={1000} alt="" sizes="(max-width: 900px) 100vw, 72rem" />;
				}
				return paragraph.charCodeAt(0) !== 13 ? <p key={index}>{paragraph.replace("&lt;", "<").replace("&gt;", ">")}</p> : null;
			})}
		</>
	);
}

export default function Article({ article, mainSpread }: Props) {
	const category = article.category;

	return (
		<>
			<Head>
				<title>{`${article.title} | The Tower`}</title>
				<meta property="og:title" content={article.title + " | The Tower"} />
				<meta property="og:description" content="Read more about this article!" />
			</Head>

			{/* Category top-right */}
			<ReturnToCategoryButton category={category} />

			<ArticleContent article={article} />
			<VanguardSpreadCard article={article} spread={mainSpread} />

			<SubBanner title="Subscribing helps us make more articles like this." />
		</>
	);
}
