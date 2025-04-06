/** @format */

import { article } from "@prisma/client";
import Head from "next/head";
import ArticlePreview from "~/components/preview.client";
import { getArticlesByAuthor } from "~/lib/queries";

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

	return (
		<div className="credit">
			<Head>
				<title>{title}</title>
				<meta property="og:title" content={title} />
				<meta property="og:description" content={metaDesc} />
			</Head>

			<style jsx>{`
				.credit {
					max-width: 85vw;
					margin: auto;
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
					font-size: 1.8rem;
					margin-top: 5vh;
				}
			`}</style>

			<h1>{author}&apos;s Work</h1>

			{articles.length > 0 ? (
				articles.map(article => <ArticlePreview key={article.id} article={article} style="row" size="small" />)
			) : (
				<p className="empty">No work found with this name.</p>
			)}
		</div>
	);
}
