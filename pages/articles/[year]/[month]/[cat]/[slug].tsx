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
import { article } from "@prisma/client";

import articleStyles from "./article.module.scss";

function toSpotifyEmbedSrc(raw?: string | null): string | null {
	if (!raw) return null;
	const trimmed = raw.trim();
	// Support spotify:episode:ID or spotify:track:ID
	if (trimmed.startsWith("spotify:")) {
		const parts = trimmed.split(":"); // ["spotify","episode","ID"]
		if (parts.length >= 3 && (parts[1] === "episode" || parts[1] === "track")) {
			return `https://open.spotify.com/embed/${parts[1]}/${parts[2]}`;
		}
	}
	try {
		const u = new URL(trimmed);
		// Expect /episode/{id} or /track/{id}
		const segments = u.pathname.split("/").filter(Boolean);
		if (segments.length >= 2 && (segments[0] === "episode" || segments[0] === "track")) {
			const type = segments[0];
			const id = segments[1];
			return `https://open.spotify.com/embed/${type}/${id}`;
		}
		// Fallback regex if URL parsing above fails to match
		const m = trimmed.match(/(episode|track)\/([A-Za-z0-9]+)/);
		if (m) {
			return `https://open.spotify.com/embed/${m[1]}/${m[2]}`;
		}
	} catch (_e) {
		// Not a valid URL; attempt simple fallback parse
		const m = trimmed.match(/(episode|track)\/([A-Za-z0-9]+)/);
		if (m) {
			return `https://open.spotify.com/embed/${m[1]}/${m[2]}`;
		}
	}
	return null;
}

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
	spotifyUrl?: string | null;
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

	if (isNaN(Number(article_id))) {
		raw = await getArticle(params.year, params.month, params.cat, "null", params.slug);
	} else {
		raw = await getArticle(params.year, params.month, params.cat, article_id, params.slug);
	}

	if (!raw) return { redirect: { permanent: false, destination: "/404" } };

	const processedArticle: ExtendedArticle = {
		...raw, // this is my first time doing ts so idk if this is chill but like should work?
		featured: raw.featured ?? false,
		markdown: raw.markdown ?? false,
		contentInfo: raw.contentInfo ?? null,
		spotifyUrl: (raw as any).spotifyUrl ?? null,
	};

	if (processedArticle.markdown) {
		const marked = await remark().use(html).process(processedArticle.content);
		processedArticle.content = marked.toString();
	}

	return { props: { article: processedArticle } };
}

function ReturnToCategoryButton({ isMobile, scrolledPast, category }: { isMobile: boolean; scrolledPast: boolean; category: string }) {
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
			<ReturnToCategoryButton isMobile={isMobile} scrolledPast={scrolledPast} category={category} />

			<section className={articleStyles["content"]}>
				<div className={articleStyles["titleblock"]}>
					<h1>{article.title}</h1>
					<span className={articleStyles["date"]}>{displayDate(article.year, article.month)}</span>
					{article.authors.length > 0 && (
						<section className={articleStyles["authors"]}>
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
					{/* Spotify read‑aloud embed below authors, above image */}
					{(() => {
						const src =
							toSpotifyEmbedSrc((article as any).spotifyUrl) ||
							toSpotifyEmbedSrc(article.contentInfo ?? undefined) ||
							toSpotifyEmbedSrc(article.content ?? undefined);
						return src ? (
							<iframe
								style={{ borderRadius: 12, width: "100%" }}
								src={src}
								height={152}
								frameBorder={0}
								allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
								loading="lazy"
								title="Listen while you read"
							/>
						) : null;
					})()}

					{article.img && (
						<>
							<Image src={article.img} width={1000} height={1000} alt={article.img} />
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

								return <Image key={index} src={src} alt="" width={1000} height={600} />;
							}
							return paragraph.charCodeAt(0) !== 13 ? <p key={index}>{paragraph.replace("&lt;", "<").replace("&gt;", ">")}</p> : null;
						})}
					</div>
				)}
			</section>

			<SubBanner title="Subscribing helps us make more articles like this." />
		</>
	);
}
