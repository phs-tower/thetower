/**
 * eslint-disable react/jsx-key
 *
 * @format
 */

/** @format */

import { article } from "@prisma/client";
import Head from "next/head";
import Image from "next/image";
import { getArticle } from "~/lib/queries";
import { displayDate } from "~/lib/utils";
import styles from "~/lib/styles";
import CreditLink from "~/components/credit.client";
import { remark } from "remark";
import html from "remark-html";
import SubBanner from "~/components/subbanner.client";

interface Props {
	article: article;
}

interface Params {
	params: {
		year: string;
		month: string;
		cat: string;
		slug: string;
	};
}

export async function getServerSideProps({ params }: Params) {
	// get id from slug
	const article_id = params.slug.split("-").slice(-1)[0];
	// test if id is a number
	// if (isNaN(Number(article_id))) {
	// 	// old scheme
	// 	return {
	// 		props: {
	// 			article: await getArticle(params.year, params.month, params.cat, "null", params.slug),
	// 		},
	// 	};
	// }
	// // new scheme
	// return {
	// 	props: {
	// 		article: await getArticle(params.year, params.month, params.cat, article_id, params.slug),
	// 	},
	// };

	let processedArticle: article | null = null;
	if (isNaN(Number(article_id))) {
		processedArticle = await getArticle(params.year, params.month, params.cat, "null", params.slug);
	} else {
		processedArticle = await getArticle(params.year, params.month, params.cat, article_id, params.slug);
	}

	if (processedArticle == null) return { redirect: { permanent: false, destination: "/404" } };

	if (processedArticle?.markdown) {
		let markedContent = await remark().use(html).process(processedArticle.content);
		processedArticle.content = markedContent.toString();

		return { props: { article: processedArticle } };
	}

	return { props: { article: processedArticle } };
}

export default function Article({ article }: Props) {
	// remark().use(html).process(article.content).then((markedContent) => {

	// })
	// const markedHTML = markedContent.toString()
	// const paragraphs = article.content.split("\n");
	article.content.split("\n").forEach(p => console.log(`'${p}'`));

	return (
		<div className="article">
			<Head>
				<title>{article.title} | The Tower</title>
				<meta property="og:title" content={article.title + " | The Tower"} />
				<meta property="og:description" content="Read more about this article!" />
			</Head>
			<style jsx>{`
				.article {
					display: flex;
					flex-direction: column;
					align-items: center;
				}

				.article .main-img {
					width: 55vw;
					height: 70vh;
					position: relative;
				}
				.article .img {
					width: 48vw;
					height: 60vh;
					position: relative;
				}
				.article .content {
					margin-top: 5vh;
					max-width: 50vw;
				}

				.main-article:not(h1, h2, h3, blockquote p)::first-letter {
					initial-letter: 3;
					margin-right: 10px;
				}
				@media screen and (max-width: 1000px) {
					.article .content {
						max-width: 100vw;
						margin-left: 10px;
						margin-right: 10px;
					}
					.main-article:not(h1, h2, h3, blockquote p)::first-letter {
						initial-letter: 1;
						margin-right: 0px;
					}
				}
				
				:global(.article .content p) {
					font-family: ${styles.font.serifText};
					// font-size: 1.2rem;
				}

				:global(.article .content strong) {
					font-family: ${styles.font.serifHeader};
				}
				
				:global(.article p) {
					margin-top: 3vh;
					margin-bottom: 3vh;
				}
				.article .titleblock {
					display: block;
					text-align: center;
				}
				.article .titleblock h1 {
					/* font-size: 2.5rem;
					font-weight: 800;
					font-family: ${styles.font.serifHeader}; */
				}

				:global(.main-article blockquote) {
					border-left: 3px solid lightgray;
					padding-left: 5px;
				}

				:global(.main-article blockquote p) {
					font-size: 2.5rem !important;
					font-family: "Neue Montreal Regular" !important;
					font-weight: normal; !important;
				}

				:global(.main-article pre) {
					background-color: lightgray;
				}

				:global(.main-article code) {
					font-family: monospace;
					// padding-left: 5px;
					font-size: 1.6rem;
				}

				:global(.main-article a) {
					text-decoration: underline;
					font-size: 2rem;
				}
			`}</style>

			<section className="content">
				<div className="titleblock">
					<h1>{article.title}</h1>

					<span style={{ fontFamily: styles.font.sans }}>{displayDate(article.year, article.month)}</span>

					{article.authors.length > 0 && (
						<section className="authors">
							{article.authors.map((author, index) => (
								<>
									<CreditLink key={index} author={author} />
									{index < article.authors.length - 1 ? <span style={{ marginLeft: "5px", marginRight: "5px" }}> • </span> : ""}
								</>
							))}
						</section>
					)}
				</div>
				<br></br>
				<br></br>
				<div>
					{article.img && (
						<Image src={article.img} width={1000} height={1000} alt={article.img} style={{ width: "100%", height: "auto" }} />
					)}
					{/* {caption exists ? (<p>{caption or whatever}</p>) : () }*/}
				</div>

				{article.markdown ? (
					<div className="main-article" dangerouslySetInnerHTML={{ __html: article.content }} />
				) : (
					<div className="main-article">
						{article.content
							.split("\n")
							.map((paragraph, index) =>
								paragraph.startsWith("@img=") ? (
									<img src={paragraph.substring(5)} width="100%" height="auto" key={index}></img>
								) : paragraph.charCodeAt(0) != 13 ? (
									<p key={index}>{paragraph.replace("&lt;", "<").replace("&gt;", ">")}</p>
								) : (
									""
								)
							)}
					</div>
				)}
			</section>
			<SubBanner title="Subscribing helps us make more articles like this." />
		</div>
	);
}
