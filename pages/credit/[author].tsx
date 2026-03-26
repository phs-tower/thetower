/** @format */

import { article } from "@prisma/client";
import Head from "next/head";
import { GetStaticPaths, GetStaticProps } from "next";
import { ParsedUrlQuery } from "querystring";
import Link from "next/link";
import ArticlePreview, { PreviewArticle } from "~/components/preview.client";
import { CrosswordCreditItem, getArticlesByAuthor, getCrosswordsByAuthor } from "~/lib/queries";
import { toCrosswordResultItem } from "~/lib/search";
import { displayDate, expandCategorySlug } from "~/lib/utils";

const PHOTO_KEYWORDS = ["photo", "image", "graphic"];

function getPhotoLabel(article: article, normalizedAuthor: string): "IMAGE" | undefined {
	if (!normalizedAuthor) return undefined;
	const isListedAuthor = Array.isArray(article.authors) && article.authors.some(name => name?.trim().toLowerCase() === normalizedAuthor);
	if (isListedAuthor) return undefined;
	const info = article.contentInfo;
	if (!info) return undefined;
	const isPhotoCredit = info.split(/\r?\n/).some(line => {
		const lower = line.toLowerCase();
		return lower.includes(normalizedAuthor) && PHOTO_KEYWORDS.some(keyword => lower.includes(keyword));
	});
	return isPhotoCredit ? "IMAGE" : undefined;
}

interface Params extends ParsedUrlQuery {
	author: string;
}

interface Props {
	author: string;
	articles: article[];
	crosswords: CrosswordCreditItem[];
}

export const getStaticPaths: GetStaticPaths<Params> = async () => ({
	paths: [],
	fallback: "blocking",
});

export const getStaticProps: GetStaticProps<Props, Params> = async ({ params }) => {
	if (!params) return { notFound: true };

	const author = decodeURI(params.author);
	const [articles, crosswords] = await Promise.all([getArticlesByAuthor(author), getCrosswordsByAuthor(author)]);

	return {
		props: {
			author,
			articles,
			crosswords,
		},
		revalidate: 60,
	};
};

export default function Credit({ author, articles, crosswords }: Props) {
	const title = `${author}'s Work | The Tower`;
	const metaDesc = `${author}'s contributions to The Tower as a writer, crossword constructor, or photographer.`;
	const normalizedAuthor = author.trim().toLowerCase();
	const work: PreviewArticle[] = [...crosswords.map(crossword => toCrosswordResultItem(crossword)), ...articles].sort((a, b) => {
		if (b.year !== a.year) return b.year - a.year;
		if (b.month !== a.month) return b.month - a.month;
		return b.id - a.id;
	});
	const hasAnyWork = work.length > 0;
	const workLabel = `${work.length} ${work.length === 1 ? "piece" : "pieces"}`;

	return (
		<div className="credit">
			<Head>
				<title>{title}</title>
				<meta property="og:title" content={title} />
				<meta property="og:description" content={metaDesc} />
			</Head>

			<style jsx>{`
				.credit {
					max-width: 100%;
				}
				:global(.credit .page-grid) {
					grid-template-columns: minmax(1.25rem, 1fr) minmax(0, 82rem) minmax(1.25rem, 1fr);
					column-gap: 0;
				}
				:global(.credit .center-column) {
					width: 100%;
					max-width: 82rem;
				}
				h1 {
					text-align: center;
					border-bottom: 3px double black;
					margin-bottom: 0.45rem;
				}
				.count {
					margin: 0 0 2vh;
					text-align: center;
					color: #707070;
					font-family: Neue Montreal;
					font-size: 0.98rem;
					letter-spacing: 0.04em;
					text-transform: uppercase;
				}
				.empty {
					text-align: center;
					font-family: Neue Montreal;
					color: gray;
					font-size: 1.1rem;
					margin-top: 5vh;
				}
				.meta {
					font-size: 0.95rem;
					color: #6b7280;
					margin-top: 0.15rem;
					margin-bottom: 0.55rem;
					font-weight: 600;
				}
				.meta a {
					text-decoration: underline;
					color: #0070f3;
				}
				.meta a:hover {
					color: #0055cc;
				}
				:global(.credit .article-preview > .category-list-preview) {
					display: grid;
					grid-template-columns: minmax(27.5rem, 1.08fr) minmax(0, 1fr);
					column-gap: 1.9rem;
					align-items: start;
				}
				:global(.credit .article-preview.row.category-list .img-wrapper) {
					display: flex;
					justify-content: flex-start;
					margin-right: 0 !important;
				}
				:global(.credit .article-preview.row.category-list .img-wrapper span) {
					display: block !important;
					width: 100% !important;
				}
				:global(.credit .article-preview.row.category-list .preview-image) {
					width: 100% !important;
					height: auto !important;
					max-width: 100% !important;
					max-height: 16rem !important;
					object-fit: cover !important;
					border-radius: 0;
					box-shadow: 0px 5px 12px #00000022;
				}
				:global(.credit .article-preview.row.category-list.noimg .preview-image) {
					object-fit: contain !important;
					background: black;
				}
				:global(.credit .article-preview.row.category-list .title) {
					margin-top: 0;
				}
				@media (max-width: 900px) {
					:global(.credit .page-grid) {
						grid-template-columns: 1fr;
					}
					:global(.credit .article-preview > .category-list-preview) {
						grid-template-columns: 1fr;
						row-gap: 1.5rem;
					}
					:global(.credit .article-preview.row.category-list .preview-image) {
						max-width: 100% !important;
						max-height: 12rem !important;
					}
				}
			`}</style>

			<div className="page-grid">
				<div className="center-column">
					<h1>{author}&apos;s Work</h1>
					<p className="count">{workLabel}</p>

					{work.map(article => {
						const isCrossword = article.category === "crossword";
						const sectionLabel = expandCategorySlug(article.category);

						return (
							<div key={`${article.category}-${article.id}`} style={{ marginBottom: "1.25rem" }}>
								<div className="meta">
									{isCrossword ? null : <Link href={`/category/${encodeURIComponent(article.category)}`}>{sectionLabel}</Link>}
									{!isCrossword ? " - " : ""}
									{displayDate(article.year, article.month)}
								</div>
								<ArticlePreview
									article={article}
									style="row"
									size="category-list"
									eyebrow={article.category === "crossword" ? undefined : getPhotoLabel(article as article, normalizedAuthor)}
									showPreviewText
								/>
							</div>
						);
					})}

					{!hasAnyWork ? <p className="empty">No work found with this name.</p> : null}
				</div>
			</div>
		</div>
	);
}
