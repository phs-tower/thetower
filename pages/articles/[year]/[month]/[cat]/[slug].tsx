/** @format */

import Head from "next/head";
import Image from "next/image";
import { getArticle } from "~/lib/queries";
import { displayDate } from "~/lib/utils";
import styles from "~/lib/styles";
import CreditLink from "~/components/credit.client";
import { remark } from "remark";
import html from "remark-html";
import SubBanner from "~/components/subbanner.client";
import PhotoCredit from "~/components/photocredit";
import Link from "next/link";
import { useEffect, useState } from "react";

// 👇 Extend article manually to include contentInfo
interface ExtendedArticle {
	id: number;
	title: string;
	content: string;
	published: boolean;
	category: string;
	subcategory: string;
	authors: string[];
	month: number;
	year: number;
	img: string;
	featured: boolean;
	markdown: boolean;
	contentInfo?: string | null;
}

interface Props {
	article: ExtendedArticle;
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
	const article_id = params.slug.split("-").slice(-1)[0];

	let raw = null as Awaited<ReturnType<typeof getArticle>>;

	if (isNaN(Number(article_id))) {
		raw = await getArticle(params.year, params.month, params.cat, "null", params.slug);
	} else {
		raw = await getArticle(params.year, params.month, params.cat, article_id, params.slug);
	}

	if (!raw) return { redirect: { permanent: false, destination: "/404" } };

	const processedArticle: ExtendedArticle = {
		id: raw.id,
		title: raw.title,
		content: raw.content,
		published: raw.published,
		category: raw.category,
		subcategory: raw.subcategory,
		authors: raw.authors,
		month: raw.month,
		year: raw.year,
		img: raw.img,
		featured: raw.featured ?? false,
		markdown: raw.markdown ?? false,
		contentInfo: raw.contentInfo ?? null,
	};

	if (processedArticle.markdown) {
		const marked = await remark().use(html).process(processedArticle.content);
		processedArticle.content = marked.toString();
	}

	return { props: { article: processedArticle } };
}

export default function Article({ article }: Props) {
	const photoName = (() => {
		if (!article.contentInfo) return null;

		const firstLine = article.contentInfo.split("\n")[0];
		if (!firstLine.includes(":")) return null;

		const [label, value] = firstLine.split(":");
		const lowerLabel = label.toLowerCase();

		if (lowerLabel.includes("photo") || lowerLabel.includes("image") || lowerLabel.includes("graphic")) {
			const name = value.trim().split(/\s+/).slice(0, 2).join(" ");
			return name;
		}

		return null;
	})();

	const [scrolledPast, setScrolledPast] = useState(false);
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const handleResize = () => {
			setIsMobile(window.innerWidth <= 1000); // Adjust threshold as needed
		};

		const handleScroll = () => {
			if (!isMobile) {
				setScrolledPast(window.scrollY > 100);
			}
		};

		handleResize(); // set on first load
		window.addEventListener("resize", handleResize);
		window.addEventListener("scroll", handleScroll);

		return () => {
			window.removeEventListener("resize", handleResize);
			window.removeEventListener("scroll", handleScroll);
		};
	}, [isMobile]);

	const category = article.category;
	const categoryLabels: { [key: string]: string } = {
		"news-features": "NEWS & FEATURES",
		opinions: "OPINIONS",
		vanguard: "VANGUARD",
		sports: "SPORTS",
		"arts-entertainment": "ARTS & ENTERTAINMENT",
		crossword: "CROSSWORD",
	};

	return (
		<div className="article">
			<Head>
				<title>{`${article.title} | The Tower`}</title>
				<meta property="og:title" content={article.title + " | The Tower"} />
				<meta property="og:description" content="Read more about this article!" />
			</Head>

			<style jsx>{`
				.article {
					display: flex;
					flex-direction: column;
					align-items: center;
					position: relative;
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

				.category-button {
					border: 2px solid ${styles.color.darkAccent};
					background-color: white;
					color: black;
					padding: 0.5rem 1.4rem;
					font-size: 1.4rem;
					font-family: ${styles.font.sans};
					border-radius: 5px;
					transition: 0.25s;
					text-transform: uppercase;
					letter-spacing: 0.05em;
					display: inline-block;
					text-align: center;
					cursor: pointer;
					text-decoration: none;
				}

				.category-button:hover {
					background-color: ${styles.color.darkAccent};
					color: white;
					text-decoration: none;
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

					.category-label {
						position: static;
						text-align: center;
						margin-bottom: 1rem;
					}

					.category-label p {
						text-align: center;
					}

					.main-article:not(h1, h2, h3, blockquote p)::first-letter {
						initial-letter: 1;
						margin-right: 0px;
					}
				}

				:global(.article .content p) {
					font-family: ${styles.font.serifText};
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

				:global(.main-article blockquote) {
					border-left: 3px solid lightgray;
					padding-left: 5px;
				}

				:global(.main-article blockquote p) {
					font-size: 2.5rem !important;
					font-family: "Neue Montreal Regular" !important;
				}

				:global(.main-article pre) {
					background-color: lightgray;
				}

				:global(.main-article code) {
					font-family: monospace;
					font-size: 1.6rem;
				}

				:global(.main-article a) {
					text-decoration: underline;
					font-size: 2rem;
				}
			`}</style>

			{/* Category top-right */}
			<div
				className="category-label"
				style={{
					position: !isMobile && scrolledPast ? "fixed" : "absolute",
					top: !isMobile && scrolledPast ? "7.5rem" : "-2rem",
					right: !isMobile && scrolledPast ? "7.1rem" : "2rem",
					zIndex: 1000,
				}}
			>
				<Link href={`/category/${category}`} legacyBehavior>
					<a className="category-button">{categoryLabels[category] || category.toUpperCase()} ↗</a>
				</Link>
			</div>

			<section className="content">
				<div className="titleblock">
					<h1>{article.title}</h1>
					<span style={{ fontFamily: styles.font.sans }}>{displayDate(article.year, article.month)}</span>

					{article.authors.length > 0 && (
						<section className="authors">
							{article.authors.map((author, index) => (
								<>
									<CreditLink key={index} author={author} />
									{index < article.authors.length - 1 && <span style={{ margin: "0 5px" }}>•</span>}
								</>
							))}
						</section>
					)}
				</div>

				<br />
				<br />

				<div>
					{article.img && (
						<>
							<Image src={article.img} width={1000} height={1000} alt={article.img} style={{ width: "100%", height: "auto" }} />
							{article.contentInfo && <PhotoCredit contentInfo={article.contentInfo} />}
						</>
					)}
				</div>

				{article.markdown ? (
					<div className="main-article" dangerouslySetInnerHTML={{ __html: article.content }} />
				) : (
					<div className="main-article">
						{article.content.split("\n").map((paragraph, index) => {
							if (paragraph.startsWith("@img=")) {
								const src = paragraph.substring(5).trim();
								if (src) {
									return <Image key={index} src={src} alt="" width={1000} height={600} style={{ width: "100%", height: "auto" }} />;
								}
								return null;
							}
							return paragraph.charCodeAt(0) !== 13 ? <p key={index}>{paragraph.replace("&lt;", "<").replace("&gt;", ">")}</p> : null;
						})}
					</div>
				)}
			</section>

			<SubBanner title="Subscribing helps us make more articles like this." />
		</div>
	);
}
