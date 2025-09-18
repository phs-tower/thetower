/** @format */

import { article } from "@prisma/client";
import Head from "next/head";
import ArticlePreview from "~/components/preview.client";
import { getArticlesByDate } from "~/lib/queries";
import Link from "next/link";
import { displayDate } from "~/lib/utils";

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
	return (
		<div>
			<style jsx>{`
				.triple {
					display: grid;
					grid-gap: 10px;
					grid-template-columns: 1.5fr 1fr 1fr;
				}
				@media (max-width: 1000px) {
					.triple {
						grid-template-columns: 1fr;
					}
				}
			`}</style>
			<Head>
				<meta property="og:title" content="Home | The Tower" />
				<meta property="og:description" content="The Tower is Princeton High School's newspaper club." />
			</Head>
			<h1 style={{ textAlign: "center" }}>{`${displayDate(year, month)} Archives`}</h1>
			<Link href={`https://yusjougmsdnhcsksadaw.supabase.co/storage/v1/object/public/prints/${month}-${year}.pdf`}>
				<p style={{ textAlign: "center", textDecoration: "underline" }}>Download digital copy</p>
			</Link>
			<br />
			<div className="mosaic">
				<div className="one triple">
					<div>
						<NewsFeatures {...articles["news-features"]} />
						<Sports {...articles["sports"]} />
					</div>
					<Opinions {...articles["opinions"]} />
					<ArtsEntertainment {...articles["arts-entertainment"]} />
				</div>
			</div>
		</div>
	);
}

export function NewsFeatures(articles: article[]) {
	return (
		<div className="newfe">
			<style jsx>{`
				.newfe {
					padding-right: 10px;
					border-right: 1px solid gainsboro;
				}
				.double {
					display: grid;
					grid-gap: 10px;
					grid-template-columns: 1fr 1fr;
				}
			`}</style>
			<ArticlePreview article={articles[0]} style="box" size="large" category />
			<div className="double">
				{Object.values(articles)
					.slice(1)
					.map(article => (
						<ArticlePreview key={article.id} article={article} style="box" size="small" category />
					))}
			</div>
		</div>
	);
}

export function Opinions(articles: article[]) {
	return (
		<div className="opinions">
			<style jsx>{``}</style>
			<div>
				<ArticlePreview article={articles[0]} style="box" size="medium" category />
				<div>
					{Object.values(articles)
						.slice(1)
						.map(article => (
							<ArticlePreview key={article.id} style="row" size="medium" category article={article} />
						))}
				</div>
			</div>
		</div>
	);
}

export function ArtsEntertainment(articles: article[]) {
	return (
		<div className="ane">
			<style jsx>{`
				.ane {
					padding-left: 10px;
					border-left: 1px solid gainsboro;
				}
			`}</style>
			<ArticlePreview article={articles[0]} style="box" size="large" category />
			<div>
				{Object.values(articles)
					.slice(1)
					.map(article => (
						<ArticlePreview key={article.id} style="row" size="medium" article={article} category />
					))}
			</div>
		</div>
	);
}

export function Sports(articles: article[]) {
	return (
		<div className="sports">
			<style jsx>{`
				.sports {
					padding-right: 10px;
					border-right: 1px solid gainsboro;
				}
				.double {
					display: grid;
					grid-gap: 10px;
					grid-template-columns: 1fr 1fr;
				}
			`}</style>
			<ArticlePreview article={articles[0]} style="box" size="large" category />
			<div>
				{Object.values(articles)
					.slice(1)
					.map(article => (
						<ArticlePreview key={article.id} style="row" size="small" article={article} category />
					))}
			</div>
		</div>
	);
}
