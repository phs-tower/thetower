/** @format */

import { article, spreads } from "@prisma/client";
import Head from "next/head";
import Image from "next/image";
import { FiArrowDown } from "react-icons/fi";
import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from "react";
import ArticlePreview from "~/components/preview.client";
import Advertisement from "~/components/advertisement";
import { getFrontpageArticles, getIdOfNewest, getRecommendedSubcategoryArticle, getSpreadsByCategory } from "~/lib/queries";
import SubBanner from "~/components/subbanner.client";
import { SectionContainer, VanguardContainer } from "~/components/sectioncontainer.client";
import { getLatestArchiveIssueInfo, getTowerVolumeNumber } from "~/lib/utils";
import { APP_STORE_URL } from "~/lib/app-links";

const DownloadArrow = FiArrowDown as ComponentType<{ size?: number }>;

export async function getStaticProps() {
	const latestIssue = getLatestArchiveIssueInfo();
	const [articles, vanguardSpreads, featuredVanguardArticle] = await Promise.all([
		getFrontpageArticles(),
		getSpreadsByCategory("vanguard", 1, await getIdOfNewest("spreads", "vanguard"), 0),
		getRecommendedSubcategoryArticle("vanguard", "articles"),
	]);

	return {
		props: {
			articles,
			vanguardSpreads,
			featuredVanguardArticle,
			volumeLabel: latestIssue ? `Vol. ${getTowerVolumeNumber(latestIssue.year)}` : null,
		},
		revalidate: 60, // Regenerate once every minute
	};
}

interface Props {
	articles: { [name: string]: article[] };
	vanguardSpreads: spreads[];
	featuredVanguardArticle: article | null;
	volumeLabel: string | null;
}

export default function FrontPage({ articles, vanguardSpreads, featuredVanguardArticle, volumeLabel }: Props) {
	const leftBottomArticle = featuredVanguardArticle ?? articles["opinions"][1];
	const leftTopArticleId = articles["opinions"][0]?.id ?? null;
	const rightTopArticleId = articles["sports"][0]?.id ?? null;
	const rightBottomArticleId = articles["arts-entertainment"][0]?.id ?? null;
	const leftTopCardRef = useRef<HTMLDivElement>(null);
	const leftBottomCardRef = useRef<HTMLDivElement>(null);
	const rightColumnRef = useRef<HTMLDivElement>(null);
	const [leftBottomImageHeight, setLeftBottomImageHeight] = useState<number | null>(null);
	const mobileHeroArticles = [
		articles["featured"][0],
		articles["opinions"][0],
		leftBottomArticle,
		articles["sports"][0],
		articles["arts-entertainment"][0],
	]
		.filter((item): item is article => Boolean(item))
		.filter((item, index, list) => list.findIndex(candidate => candidate.id === item.id) === index);

	useEffect(() => {
		const measureLeftBottomCard = () => {
			if (typeof window === "undefined" || window.innerWidth <= 1000) {
				setLeftBottomImageHeight(null);
				return;
			}

			const leftTopCard = leftTopCardRef.current;
			const leftBottomCard = leftBottomCardRef.current;
			const rightColumn = rightColumnRef.current;
			const leftBottomImage = leftBottomCard?.querySelector(".preview-image") as HTMLElement | null;

			if (!leftTopCard || !leftBottomCard || !rightColumn || !leftBottomImage) return;

			const leftTopRect = leftTopCard.getBoundingClientRect();
			const leftBottomRect = leftBottomCard.getBoundingClientRect();
			const rightRect = rightColumn.getBoundingClientRect();
			const imageRect = leftBottomImage.getBoundingClientRect();

			if (!leftTopRect.height || !leftBottomRect.height || !rightRect.height || !imageRect.height) return;

			const gap = Math.max(0, leftBottomRect.top - leftTopRect.bottom);
			const leftBottomNonImageHeight = leftBottomRect.height - imageRect.height;
			const nextImageHeight = Math.max(220, Math.round(rightRect.height - leftTopRect.height - gap - leftBottomNonImageHeight));

			setLeftBottomImageHeight(prev => (prev !== null && Math.abs(prev - nextImageHeight) < 2 ? prev : nextImageHeight));
		};

		const scheduleMeasure = () => {
			window.requestAnimationFrame(measureLeftBottomCard);
		};

		scheduleMeasure();
		window.addEventListener("resize", scheduleMeasure);

		const observer =
			typeof ResizeObserver !== "undefined"
				? new ResizeObserver(() => {
						scheduleMeasure();
				  })
				: null;

		if (observer) {
			if (leftTopCardRef.current) observer.observe(leftTopCardRef.current);
			if (leftBottomCardRef.current) observer.observe(leftBottomCardRef.current);
			if (rightColumnRef.current) observer.observe(rightColumnRef.current);
		}

		return () => {
			window.removeEventListener("resize", scheduleMeasure);
			observer?.disconnect();
		};
	}, [leftBottomArticle?.id, leftTopArticleId, rightTopArticleId, rightBottomArticleId]);

	return (
		<div>
			<Head>
				<meta property="og:title" content="Home | The Tower" />
				<meta property="og:description" content="The Tower is Princeton High School's newspaper club." />
			</Head>
			<style jsx>{`
				.app-announcement {
					display: flex;
					align-items: center;
					gap: 1rem;
					margin: 0 0 2rem;
				}
				.app-announcement::before,
				.app-announcement::after {
					content: "";
					flex: 1;
					height: 1px;
					background: var(--accent);
				}
				.app-announcement a {
					display: flex;
					justify-content: center;
					align-items: center;
					gap: 0.75rem;
					padding: 0.8rem 1.5rem;
					background: var(--accent);
					color: white;
					text-align: left;
					font-family: var(--font-sans);
					border-radius: 4px;
					opacity: 1;
					transition: background-color 180ms ease;
				}
				.app-mark {
					display: flex;
					flex-shrink: 0;
					align-items: center;
					padding-right: 0.85rem;
					border-right: 1px solid #ffffff40;
				}
				.app-copy {
					display: flex;
					flex-direction: column;
					align-items: flex-start;
					gap: 0.25rem;
				}
				.app-announcement strong,
				.app-announcement span {
					font-family: inherit;
					font-size: 1rem;
					font-weight: 400;
					line-height: 1.5;
					color: inherit;
				}
				.app-announcement strong {
					font-family: var(--font-sans-bold);
					font-size: 0.75rem;
					letter-spacing: 0.1em;
					line-height: 1;
					padding: 0.25rem 0.4rem;
					background: #dce8f8;
					color: var(--accent);
					border-radius: 2px;
				}
				.app-copy > span {
					font-size: 1.125rem;
				}
				.app-label {
					display: flex;
					align-items: center;
					gap: 0.5rem;
				}
				.app-label span {
					font-size: 0.875rem;
					letter-spacing: 0.025em;
				}
				.app-announcement .app-arrow {
					display: flex;
					align-items: center;
					justify-content: center;
					width: 2rem;
					height: 2rem;
					margin-left: 0.5rem;
					border: 1px solid #ffffff60;
					border-radius: 50%;
					flex-shrink: 0;
					transition: transform 180ms ease;
				}
				.app-announcement a:hover {
					background: var(--accent-dark);
					opacity: 1;
				}
				.app-announcement a:hover .app-arrow {
					transform: translateY(2px);
				}
				@media (prefers-reduced-motion: reduce) {
					.app-announcement a,
					.app-announcement .app-arrow {
						transition: none;
					}
					.app-announcement a:hover .app-arrow {
						transform: none;
					}
				}
				.app-announcement a:focus-visible {
					outline: 2px solid var(--accent);
					outline-offset: 4px;
				}
				@media (max-width: 600px) {
					.app-announcement {
						gap: 0.5rem;
						margin-bottom: 1.5rem;
					}
					.app-announcement a {
						padding: 0.65rem 0.75rem;
						gap: 0.6rem;
					}
					.app-copy > span {
						font-size: 1rem;
					}
					.app-announcement .app-arrow {
						margin-left: 0;
						width: 1.75rem;
						height: 1.75rem;
					}
				}
				:global(.mosaic .triple.home-hero) {
					display: grid;
					grid-template-columns: 0.7fr 1.6fr 0.7fr;
					column-gap: 0.2rem;
					align-items: start;
				}
				.hero-side {
					display: grid;
					grid-auto-rows: max-content;
					row-gap: 1.1rem;
					align-content: start;
				}
				.hero-left-column {
					grid-column: 1;
				}
				.hero-center {
					grid-column: 2;
				}
				.hero-right-column {
					grid-column: 3;
				}
				.hero-card hr {
					width: 100%;
					margin: 0 0 0.35rem 0;
				}
				.hero-issue {
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
				.hero-featured {
					margin-bottom: 3rem;
				}
				:global(.mosaic .triple.home-hero .hero-card .article-preview > .large-preview) {
					margin-bottom: 0 !important;
				}
				/* Keep a small consistent gap between the image and text in the home hero */
				:global(.mosaic .triple.home-hero .article-preview.box .img-wrapper) {
					margin-bottom: 0.35rem !important;
				}
				:global(.mosaic .triple.home-hero .article-preview.box:not(.featured) .title) {
					margin-top: 0 !important;
					margin-bottom: 0.25rem !important;
				}
				:global(.mosaic .triple.home-hero .article-preview.box:not(.featured) .authors) {
					margin-top: 0 !important;
				}
				:global(.mosaic .triple.home-hero .hero-featured .article-preview.box.featured .authors) {
					margin-bottom: 0.55rem !important;
				}
				:global(.mosaic .triple.home-hero .hero-featured .article-preview.box.featured .preview-text) {
					margin-top: 0.85rem !important;
					margin-bottom: 0 !important;
				}
				:global(.mosaic .triple.home-hero .hero-featured .article-preview.box.featured .preview-text.preview-text-below-image) {
					margin-top: 0.35rem !important;
				}
				:global(.mosaic .triple.home-hero .hero-card .article-preview.box .preview-image) {
					width: 100% !important;
					height: 16rem !important;
					max-width: 100% !important;
					max-height: 16rem !important;
					object-fit: cover !important;
					border-radius: 0;
					box-shadow: 0px 5px 12px #00000022;
				}
				:global(.mosaic .triple.home-hero .hero-card .article-preview.box.noimg .preview-image) {
					object-fit: contain !important;
					background: black !important;
				}
				:global(.mosaic .triple.home-hero .hero-card.hero-card-dynamic .article-preview.box .preview-image) {
					height: var(--dynamic-image-height, 16rem) !important;
					max-height: var(--dynamic-image-height, 16rem) !important;
				}
				.home-leaderboard {
					display: flex;
					justify-content: center;
					margin: 1.5rem 0 2rem;
					padding: 1.25rem 0;
					border-top: 1px solid gainsboro;
					border-bottom: 1px solid var(--accent-dark);
				}
				.home-leaderboard :global(aside) {
					box-sizing: border-box;
					width: min(100%, calc(728px + 0.9rem + 2px));
				}
				.mobile-issue {
					display: none;
				}
				@media (max-width: 1000px) {
					:global(.mosaic .triple.home-hero) {
						display: none !important;
					}

					:global(.mosaic .one.home-mobile-list) {
						display: grid;
						gap: 1.15rem;
					}

					.mobile-issue {
						display: block;
						color: #7b7f87;
						font-family: var(--font-sans);
						font-size: 0.76rem;
						font-weight: 600;
						letter-spacing: 0.08em;
						text-transform: uppercase;
						margin: 0 0 0.25rem;
						text-align: left;
					}

					:global(.home-mobile-list .mobile-featured .article-eyebrow) {
						display: inline-block;
						background: #102e63;
						color: #fff;
						font-family: var(--font-sans);
						font-size: 0.78rem;
						font-weight: 700;
						letter-spacing: 0.08em;
						text-transform: uppercase;
						padding: 0.22rem 0.55rem;
						margin: 0 0 0.55rem;
					}

					:global(.home-mobile-list .article-preview.box.large .preview-image) {
						width: 100% !important;
						height: 12rem !important;
						max-width: 100% !important;
						max-height: 12rem !important;
						object-fit: cover !important;
						margin: 0 !important;
					}

					:global(.home-mobile-list .article-preview.box.large.noimg .preview-image) {
						object-fit: contain !important;
						background: black !important;
					}

					:global(.home-mobile-list .article-preview.box) {
						padding: 0 !important;
						margin: 0 !important;
					}
				}
			`}</style>
			<div className="app-announcement">
				<a href={APP_STORE_URL} aria-label="New: Download our PHS Tower app on the App Store">
					<div className="app-mark">
						<Image src="/assets/tower-short.png" alt="" width={30} height={44} style={{ objectFit: "contain" }} />
					</div>
					<div className="app-copy">
						<div className="app-label">
							<strong>NEW</strong>
							<span>PHS Tower</span>
						</div>
						<span>Download our app</span>
					</div>
					<span className="app-arrow" aria-hidden="true">
						<DownloadArrow size={18} />
					</span>
				</a>
			</div>
			<div className="mosaic">
				<div className="triple home-hero">
					<div className="hero-side hero-left-column">
						<div className="hero-card" ref={leftTopCardRef}>
							<hr />
							{articles["opinions"][0] && <ArticlePreview article={articles["opinions"][0]} style="box" size="large" fit="cover" />}
						</div>
						<div
							className="hero-card hero-card-dynamic"
							ref={leftBottomCardRef}
							style={
								leftBottomImageHeight
									? ({ ["--dynamic-image-height" as string]: `${leftBottomImageHeight}px` } as CSSProperties)
									: undefined
							}
						>
							{leftBottomArticle && <ArticlePreview article={leftBottomArticle} style="box" size="large" fit="cover" />}
						</div>
					</div>
					<div className="hero-center">
						{volumeLabel ? <div className="hero-issue">{volumeLabel}</div> : null}
						<div className="hero-featured">
							{articles["featured"][0] && (
								<ArticlePreview article={articles["featured"][0]} style="box" size="featured" showPreviewText previewTextBelowImage />
							)}
						</div>
					</div>
					<div className="hero-side hero-right-column" ref={rightColumnRef}>
						<div className="hero-card">
							<hr />
							{articles["sports"][0] && <ArticlePreview article={articles["sports"][0]} style="box" size="large" fit="cover" />}
						</div>
						<div className="hero-card">
							{articles["arts-entertainment"][0] && (
								<ArticlePreview article={articles["arts-entertainment"][0]} style="box" size="large" fit="cover" />
							)}
						</div>
					</div>
				</div>

				<div className="one home-mobile-list">
					{volumeLabel ? <div className="mobile-issue">{volumeLabel}</div> : null}
					{mobileHeroArticles.map((article, index) => (
						<div key={article.id} className={index === 0 ? "mobile-featured" : undefined}>
							<ArticlePreview
								article={article}
								style="box"
								size="large"
								fit="cover"
								eyebrow={index === 0 ? "Recommended" : undefined}
							/>
						</div>
					))}
				</div>
			</div>
			<div className="home-leaderboard">
				<Advertisement
					href="https://www.jfcswheels4meals.org/"
					src="/assets/jfcs-wheels-heels-2026-leaderboard.png"
					width={1365}
					height={169}
					alt="JFCS Wheels & Heels for Meals, October 11, 2026 at Mercer County Community College"
				/>
			</div>
			<SectionContainer category="NEWS & FEATURES" desc="The latest stories on PHS and its community." articles={articles["news-features"]} />
			<hr />
			<br />
			<SectionContainer
				category="OPINIONS"
				desc="Opinions of the student body, from school policies to global issues."
				articles={articles["opinions"]}
			/>
			<br />
			<hr />
			<br />
			<SectionContainer category="ARTS & ENTERTAINMENT" desc="Music, theatre, and more." articles={articles["arts-entertainment"]} />
			<hr />
			<br />
			<SectionContainer category="SPORTS" desc="Updates on PHS games, tales of sports history, and more." articles={articles["sports"]} />
			<hr />
			<br />
			<VanguardContainer desc="The most creative section, with the format changing each issue." spreads={vanguardSpreads} />
			<SubBanner title="Consider subscribing to The Tower." />
		</div>
	);
}
