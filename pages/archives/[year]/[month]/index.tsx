/** @format */

import { article } from "@prisma/client";
import Head from "next/head";
import ArticlePreview from "~/components/preview.client";
import { getArticlesByDate } from "~/lib/queries";
import Link from "next/link";
import { displayDate } from "~/lib/utils";
import { SectionContainer } from "~/components/sectioncontainer.client";
import SubBanner from "~/components/subbanner.client";

interface Params {
	params: {
		year: string;
		month: string;
	};
}

export async function getServerSideProps({ params }: Params) {
	const articles: Record<string, article[]> = await getArticlesByDate(params.year, params.month);

	return {
		props: {
			articles,
			year: parseInt(params.year),
			month: parseInt(params.month),
		},
	};
}

interface Props {
	articles: { [name: string]: article[] };
	year: number;
	month: number;
}

export default function Index({ articles, year, month }: Props) {
	// Determine a featured article for this issue: prefer explicit featured, else first News & Features
	const cats = ["news-features", "opinions", "arts-entertainment", "sports"] as const;
	const featuredFromFlag = cats.map(c => (articles[c] || []).find(a => (a as any).featured)).find(Boolean) as article | undefined;
	const featured = featuredFromFlag || (articles["news-features"]?.[0] as article | undefined);

	return (
		<div>
			<Head>
				<meta property="og:title" content={`${displayDate(year, month)} Archives | The Tower`} />
				<meta property="og:description" content="The Tower is Princeton High School's newspaper club." />
			</Head>

			<style jsx>{`
				/* Match Home spacing for side columns */
				:global(.mosaic .triple .article-preview.box:not(.featured) .img-wrapper) {
					margin-bottom: -1rem !important;
				}
				:global(.mosaic .triple .article-preview.box:not(.featured) .title) {
					margin-top: 0 !important;
					margin-bottom: 0.25rem !important;
				}
				:global(.mosaic .triple .article-preview.box:not(.featured) .authors) {
					margin-top: 0 !important;
				}
				.featured-note {
					color: #777;
					font-size: 0.9rem;
					margin-top: 0.25rem;
					text-align: left;
				}
			`}</style>

			<h1 style={{ textAlign: "center" }}>{`${displayDate(year, month)} Archives`}</h1>
			<Link href={`https://yusjougmsdnhcsksadaw.supabase.co/storage/v1/object/public/prints/${month}-${year}.pdf`}>
				<p style={{ textAlign: "center", textDecoration: "underline" }}>Download digital copy</p>
			</Link>
			<br />
			<div className="mosaic">
				<div className="triple">
					{/* Left column: Opinions (2) */}
					<div>
						<hr />
						{articles["opinions"][0] && <ArticlePreview article={articles["opinions"][0]} style="box" size="large" fit="contain" />}
						{articles["opinions"][1] && <ArticlePreview article={articles["opinions"][1]} style="box" size="large" fit="contain" />}
					</div>
					{/* Center column: Featured */}
					<div>
						<div style={{ marginBottom: "0.5rem" }}>{featured && <ArticlePreview article={featured} style="box" size="featured" />}</div>
					</div>
					{/* Right column: Sports + Arts & Entertainment */}
					<div>
						<hr />
						{articles["sports"][0] && <ArticlePreview article={articles["sports"][0]} style="box" size="large" fit="contain" />}
						{articles["arts-entertainment"][0] && (
							<ArticlePreview article={articles["arts-entertainment"][0]} style="box" size="large" fit="contain" />
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

			<SubBanner title="Consider subscribing to The Tower." />
		</div>
	);
}

// Old per-section components removed to match Home layout exactly
