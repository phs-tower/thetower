/** @format */

import { article } from "@prisma/client";
import Head from "next/head";
import ArticlePreview from "~/components/preview.client";
import { getArticlesBySearch, getCurrArticles } from "~/lib/queries";
import { expandCategorySlug } from "~/lib/utils";
import shuffle from "lodash/shuffle";

interface Params {
	params: {
		search: string;
	};
}

interface Props {
	search: string;
	articles: article[];
	sidebar: article[];
}

export async function getServerSideProps({ params }: Params) {
	const sidebarArticles = await getCurrArticles();
	const shuffledSidebar = shuffle(sidebarArticles); // Do this server-side

	return {
		props: {
			search: params.search,
			articles: await getArticlesBySearch(params.search),
			sidebar: shuffledSidebar,
		},
	};
}

export default function Category({ search, articles, sidebar }: Props) {
	return (
		<div className="category">
			<Head>
				<title>{`Search: ${expandCategorySlug(search)} | The Tower`}</title>
				<meta property="og:title" content={"Search: " + expandCategorySlug(search) + " | The Tower"} />
				<meta property="og:description" content={"Search: " + expandCategorySlug(search) + " at the Tower"} />
			</Head>

			<style jsx>{`
				.category {
					min-height: 100vh;
				}
				h1 {
					text-align: center;
					border-bottom: 3px double black;
					margin-bottom: 1vh;
				}
				.grid {
					display: grid;
					grid-template-columns: 2fr 1fr;
					grid-column-gap: 2vw;
				}
				.grid .sidebar {
					margin-top: 2vh;
					padding-left: 1vw;
					padding-right: 1vw;
					border: none;
					border-left: 1px solid gainsboro;
					border-right: 1px solid gainsboro;
				}
			`}</style>

			<h1>Search: &quot;{expandCategorySlug(search)}&quot;</h1>
			<div className="grid">
				<section>
					{articles.map(article => (
						<ArticlePreview key={article.id} article={article} style="row" size="small" />
					))}
				</section>
				<section className="sidebar">
					<SidebarArticles sidebar={sidebar} />
				</section>
			</div>
		</div>
	);
}

interface SidebarProps {
	sidebar: article[];
}

function SidebarArticles({ sidebar }: SidebarProps) {
	return (
		<>
			{sidebar.map(article => (
				<ArticlePreview key={article.id} article={article} style="row" size="small" category />
			))}
		</>
	);
}
