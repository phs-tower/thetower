/** @format */

import { article } from "@prisma/client";
import Head from "next/head";
import ArticlePreview from "~/components/preview.client";
import { getArticlesByAuthor } from "~/lib/queries";

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

interface Params {
	params: {
		author: string;
	};
}

interface Props {
	author: string;
	articles: article[];
}

export async function getServerSideProps({ params }: Params) {
	const author = decodeURI(params.author);

	const articles = await getArticlesByAuthor(author); // Already checks authors + contentInfo
	return {
		props: {
			author,
			articles,
		},
	};
}

export default function Credit({ author, articles }: Props) {
	const title = `${author}'s Work | The Tower`;
	const metaDesc = `${author}'s contributions to The Tower — either as an author or a photographer.`;
	const normalizedAuthor = author.trim().toLowerCase();

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
				h1 {
					text-align: center;
					border-bottom: 3px double black;
					margin-bottom: 2vh;
				}
				.empty {
					text-align: center;
					font-family: Neue Montreal;
					color: gray;
					font-size: 1.1rem;
					margin-top: 5vh;
				}
				:global(.credit .article-preview.row.small > .small-preview) {
					display: grid;
					grid-template-columns: minmax(13.5rem, 17rem) 1fr;
					gap: 2.25rem;
					align-items: center;
				}
				:global(.credit .article-preview.row.small .img-wrapper) {
					display: flex;
					justify-content: center;
				}
				:global(.credit .article-preview.row.small .img-wrapper span) {
					display: block !important;
					width: 100% !important;
				}
				:global(.credit .article-preview.row.small .preview-image) {
					width: 100% !important;
					height: auto !important;
					max-width: 17rem !important;
					max-height: 12.5rem !important;
					object-fit: cover !important;
					border-radius: 0;
					box-shadow: 0px 5px 12px #00000022;
				}
				:global(.credit .article-preview.row.small.noimg .preview-image) {
					object-fit: contain !important;
					background: black;
				}
				:global(.credit .article-preview.row.small .title) {
					margin-top: 0;
				}
				:global(.credit .article-preview.row.small > .small-preview > div:last-child) {
					position: relative;
					display: flex;
					flex-direction: column;
					justify-content: center;
					padding-top: 1.1rem;
				}
				:global(.credit .article-preview.row.small > .small-preview > div:last-child .article-eyebrow) {
					position: absolute;
					top: 0;
					left: 0;
					margin: 0;
				}
				/* Ensure placeholder-image rows still use two-column layout on desktop */
				:global(.credit .article-preview.row.small.noimg) {
					grid-template-columns: minmax(13.5rem, 17rem) 1fr !important;
				}
				@media (max-width: 900px) {
					:global(.credit .article-preview.row.small > .small-preview) {
						gap: 1.5rem;
					}
					:global(.credit .article-preview.row.small .img-wrapper) {
						justify-content: flex-start;
					}
					:global(.credit .article-preview.row.small .preview-image) {
						max-width: 100% !important;
						max-height: 15rem !important;
					}
				}
			`}</style>

			<div className="page-grid">
				<div className="center-column">
					<h1>{author}&apos;s Work</h1>

					{articles.length > 0 ? (
						articles.map(article => (
							<ArticlePreview
								key={article.id}
								article={article}
								style="row"
								size="small"
								shrinkThumb
								eyebrow={getPhotoLabel(article, normalizedAuthor)}
							/>
						))
					) : (
						<p className="empty">No work found with this name.</p>
					)}
				</div>
			</div>
		</div>
	);
}
