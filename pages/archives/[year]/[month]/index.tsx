/** @format */

import { article, spreads } from "@prisma/client";
import Head from "next/head";
import { GetStaticPaths, GetStaticProps } from "next";
import ArticlePreview from "~/components/preview.client";
import { getArticlesByDate, getPublishedArchiveIssues, getSpreadByIssue } from "~/lib/queries";
import Link from "next/link";
import { displayDate, getTowerVolumeNumber } from "~/lib/utils";
import { SectionContainer, VanguardContainer } from "~/components/sectioncontainer.client";
import SubBanner from "~/components/subbanner.client";
import { ParsedUrlQuery } from "querystring";

interface Params extends ParsedUrlQuery {
	year: string;
	month: string;
}

export const getStaticPaths: GetStaticPaths<Params> = async () => {
	return {
		paths: [],
		fallback: "blocking",
	};
};

export const getStaticProps: GetStaticProps<Props, Params> = async ({ params }) => {
	if (!params) return { notFound: true };

	const month = parseInt(params.month);
	const year = parseInt(params.year);
	if (!Number.isInteger(month) || !Number.isInteger(year)) return { notFound: true };

	const [articles, vanguardSpread] = await Promise.all([getArticlesByDate(params.year, params.month), getSpreadByIssue("vanguard", month, year)]);
	const hasArticles = Object.values(articles).some(categoryArticles => categoryArticles.length > 0);
	if (!hasArticles && !vanguardSpread) return { notFound: true, revalidate: 60 };

	return {
		props: {
			articles,
			year,
			month,
			vanguardSpread,
		},
		revalidate: 60,
	};
};

interface Props {
	articles: { [name: string]: article[] };
	year: number;
	month: number;
	vanguardSpread: spreads | null;
}

export default function Index({ articles, year, month, vanguardSpread }: Props) {
	// Determine a featured article for this issue: prefer explicit featured, else first News & Features
	const cats = ["news-features", "opinions", "arts-entertainment", "sports"] as const;
	const featuredFromFlag = cats.map(c => (articles[c] || []).find(a => (a as any).featured)).find(Boolean) as article | undefined;
	const featured = featuredFromFlag || (articles["news-features"]?.[0] as article | undefined);
	const volumeNumber = getTowerVolumeNumber(year);
	const volumeLabel = volumeNumber ? `Vol. ${volumeNumber}` : null;

	return (
		<div>
			<Head>
				<meta property="og:title" content={`${displayDate(year, month)} Archives | The Tower`} />
				<meta property="og:description" content="The Tower is Princeton High School's newspaper club." />
			</Head>

			<style jsx>{`
				:global(.mosaic .triple.archive-hero) {
					display: grid;
					grid-template-columns: 0.7fr 1.6fr 0.7fr;
					grid-template-areas:
						"left-top center right-top"
						"left-bottom center right-bottom";
					column-gap: 0.2rem;
					row-gap: 1.1rem;
					align-items: start;
				}
				.archive-card hr {
					width: 100%;
					margin: 0 0 0.35rem 0;
				}
				.archive-left-top {
					grid-area: left-top;
				}
				.archive-left-bottom {
					grid-area: left-bottom;
				}
				.archive-center {
					grid-area: center;
				}
				.archive-right-top {
					grid-area: right-top;
				}
				.archive-right-bottom {
					grid-area: right-bottom;
				}
				.archive-volume {
					color: #7b7f87;
					font-family: var(--font-sans);
					font-size: 0.76rem;
					font-weight: 600;
					letter-spacing: 0.08em;
					text-transform: uppercase;
					margin-bottom: 0.75rem;
					padding-left: 1%;
					text-align: left;
				}
				.archive-featured {
					margin-bottom: 0.5rem;
				}
				:global(.mosaic .triple.archive-hero .archive-card .article-preview > .large-preview) {
					margin-bottom: 0 !important;
				}
				:global(.mosaic .triple.archive-hero .article-preview.box .img-wrapper) {
					margin-bottom: 0.35rem !important;
				}
				:global(.mosaic .triple.archive-hero .article-preview.box:not(.featured) .title) {
					margin-top: 0 !important;
					margin-bottom: 0.25rem !important;
				}
				:global(.mosaic .triple.archive-hero .article-preview.box:not(.featured) .authors) {
					margin-top: 0 !important;
				}
				:global(.mosaic .triple.archive-hero .archive-card .article-preview.box .preview-image) {
					width: 100% !important;
					height: 16rem !important;
					max-width: 100% !important;
					max-height: 16rem !important;
					object-fit: cover !important;
					border-radius: 0;
					box-shadow: 0px 5px 12px #00000022;
				}
				:global(.mosaic .triple.archive-hero .archive-card .article-preview.box.noimg .preview-image) {
					object-fit: contain !important;
					background: black !important;
				}

				@media (max-width: 900px) {
					:global(.mosaic .triple.archive-hero .archive-card .article-preview.box .preview-image) {
						max-width: 100% !important;
						max-height: 12rem !important;
						height: 12rem !important;
					}
					:global(.mosaic .triple.archive-hero .archive-card .article-preview.box.noimg .preview-image) {
						object-fit: contain !important;
					}
				}
			`}</style>

			<h1 style={{ textAlign: "center" }}>{`${displayDate(year, month)} Archives`}</h1>
			<Link href={`https://yusjougmsdnhcsksadaw.supabase.co/storage/v1/object/public/prints/${month}-${year}.pdf`}>
				<p style={{ textAlign: "center", textDecoration: "underline" }}>Download digital copy</p>
			</Link>
			<br />
			<div className="mosaic">
				<div className="triple archive-hero">
					<div className="archive-card archive-left-top">
						<hr />
						{articles["opinions"][0] && <ArticlePreview article={articles["opinions"][0]} style="box" size="large" fit="cover" />}
					</div>
					<div className="archive-card archive-left-bottom">
						{articles["opinions"][1] && <ArticlePreview article={articles["opinions"][1]} style="box" size="large" fit="cover" />}
					</div>
					<div className="archive-center">
						{volumeLabel ? <div className="archive-volume">{volumeLabel}</div> : null}
						<div className="archive-featured">{featured && <ArticlePreview article={featured} style="box" size="featured" />}</div>
					</div>
					<div className="archive-card archive-right-top">
						<hr />
						{articles["sports"][0] && <ArticlePreview article={articles["sports"][0]} style="box" size="large" fit="cover" />}
					</div>
					<div className="archive-card archive-right-bottom">
						{articles["arts-entertainment"][0] && (
							<ArticlePreview article={articles["arts-entertainment"][0]} style="box" size="large" fit="cover" />
						)}
					</div>
				</div>

				<div className="one">
					{articles["opinions"][0] && <ArticlePreview article={articles["opinions"][0]} style="box" size="large" />}
					{articles["opinions"][1] && <ArticlePreview article={articles["opinions"][1]} style="box" size="large" />}
					{articles["opinions"][2] && <ArticlePreview article={articles["opinions"][2]} style="box" size="large" />}

					{articles["sports"][0] && <ArticlePreview article={articles["sports"][0]} style="box" size="large" />}
					{articles["sports"][1] && <ArticlePreview article={articles["sports"][1]} style="box" size="large" />}
					{articles["sports"][2] && <ArticlePreview article={articles["sports"][2]} style="box" size="large" />}
				</div>
			</div>

			<br />
			<hr />
			<br />
			<SectionContainer
				category="NEWS & FEATURES"
				desc="The latest stories on PHS and its community."
				articles={articles["news-features"] || []}
			/>
			<hr />
			<br />
			<SectionContainer
				category="OPINIONS"
				desc="Opinions of the student body, from school policies to global issues."
				articles={articles["opinions"] || []}
			/>
			<br />
			<hr />
			<br />
			<SectionContainer category="ARTS & ENTERTAINMENT" desc="Music, theatre, and more." articles={articles["arts-entertainment"] || []} />
			<hr />
			<br />
			<SectionContainer category="SPORTS" desc="Updates on PHS games, tales of sports history, and more." articles={articles["sports"] || []} />
			{vanguardSpread ? (
				<>
					<hr />
					<br />
					<VanguardContainer desc="The most creative section, with the format changing each issue." spreads={[vanguardSpread]} />
				</>
			) : null}

			<SubBanner title="Consider subscribing to The Tower." />
		</div>
	);
}

// Old per-section components removed to match Home layout exactly
