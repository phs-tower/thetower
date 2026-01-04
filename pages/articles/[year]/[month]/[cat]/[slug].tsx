/** @format */

import Head from "next/head";
import Image from "next/image";
import { getArticle } from "~/lib/queries";
import { displayDate } from "~/lib/utils";
import CreditLink from "~/components/credit.client";
import { remark } from "remark";
import html from "remark-html";
import SubBanner from "~/components/subbanner.client";
import PhotoCredit from "~/components/photocredit";
import Link from "next/link";
import { useEffect } from "react";
import { article } from "@prisma/client";

import articleStyles from "./article.module.scss";
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

	let raw: article | null = null; // equivalent to prior but explicit

	if (isNaN(Number(article_id))) raw = await getArticle(params.year, params.month, params.cat, "null", params.slug);
	else raw = await getArticle(params.year, params.month, params.cat, article_id, params.slug);

	if (!raw) return { redirect: { permanent: false, destination: "/404" } };

	const processedArticle: ExtendedArticle = {
		...raw, // this is my first time doing ts so idk if this is chill but like should work?
		markdown: raw.markdown ?? false,
		contentInfo: raw.contentInfo ?? null,
	};

	if (processedArticle.markdown) {
		const marked = await remark().use(html).process(processedArticle.content);
		processedArticle.content = marked.toString();
	}

	return { props: { article: processedArticle } };
}

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

export function ArticleContent({ article }: Props) {
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
							alt={article.img}
							style={{ width: "100%", height: "auto", maxHeight: "70vh", objectFit: "contain" }}
						/>
						{article.contentInfo && <PhotoCredit contentInfo={article.contentInfo} />}
					</>
				)}
			</div>

			{article.markdown ? (
				<div className={articleStyles["main-article"]} dangerouslySetInnerHTML={{ __html: article.content }} />
			) : (
				<div className={articleStyles["main-article"]}>
					{article.content.split("\n").map((paragraph, index) => {
						if (paragraph.startsWith("@img=")) {
							const src = paragraph.substring(5).trim();
							if (!src) return null;

							return (
								<Image
									key={index}
									src={src}
									alt=""
									width={1000}
									height={600}
									style={{ width: "100%", height: "auto", maxHeight: "70vh", objectFit: "contain" }}
								/>
							);
						}
						return paragraph.charCodeAt(0) !== 13 ? <p key={index}>{paragraph.replace("&lt;", "<").replace("&gt;", ">")}</p> : null;
					})}
				</div>
			)}
		</section>
	);
}

export default function Article({ article }: Props) {
	// const photoName = (() => {
	// 	if (!article.contentInfo) return null;

	// 	const firstLine = article.contentInfo.split("\n")[0];
	// 	if (!firstLine.includes(":")) return null;

	// 	const [label, value] = firstLine.split(":");
	// 	const lowerLabel = label.toLowerCase();

	// 	if (lowerLabel.includes("photo") || lowerLabel.includes("image") || lowerLabel.includes("graphic")) {
	// 		const name = value.trim().split(/\s+/).slice(0, 2).join(" ");
	// 		return name;
	// 	}

	// 	return null;
	// })();

	const category = article.category;

	// Per-article view tracking (one bump per article per tab session)
	useEffect(() => {
		if (typeof window === "undefined") return;
		if (!article?.id) return;

		// Avoid double-counting in the same tab/session
		const key = `article-tracked:${article.id}`;
		if (sessionStorage.getItem(key)) return;
		sessionStorage.setItem(key, "1");

		// Send articleId to API so it increments both site_analytics and article_analytics
		fetch("/api/track", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ articleId: article.id }),
		}).catch(() => {});
	}, [article?.id]);

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

			<SubBanner title="Subscribing helps us make more articles like this." />
		</>
	);
}
