/** @format */

import { article, spreads } from "@prisma/client";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import ArticlePreview from "~/components/preview.client";
import Video from "~/components/video.client";
import Podcast from "~/components/podcast.client";
import { getFrontpageArticles, getIdOfNewest, getRecommendedSubcategoryArticle, getSpreadsByCategory } from "~/lib/queries";
import SubBanner from "~/components/subbanner.client";
import { SectionContainer, VanguardContainer } from "~/components/sectioncontainer.client";
import { getLatestArchiveIssueInfo, getTowerVolumeNumber } from "~/lib/utils";

import sponsorStyles from "./sponsor.module.scss";

export async function getStaticProps() {
	const latestIssue = getLatestArchiveIssueInfo();
	const [articles, vang, featuredVanguardArticle] = await Promise.all([
		getFrontpageArticles(),
		getSpreadsByCategory("vanguard", 1, await getIdOfNewest("spreads", "vanguard"), 0),
		getRecommendedSubcategoryArticle("vanguard", "articles"),
	]);

	return {
		props: {
			articles,
			vang,
			featuredVanguardArticle,
			volumeLabel: latestIssue ? `Vol. ${getTowerVolumeNumber(latestIssue.year)}` : null,
		},
		revalidate: 60, // Regenerate once every minute
	};
}

interface Props {
	articles: { [name: string]: article[] };
	vang: spreads[];
	featuredVanguardArticle: article | null;
	volumeLabel: string | null;
}

export default function FrontPage({ articles, vang, featuredVanguardArticle, volumeLabel }: Props) {
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
			<br />
			<hr />
			<br />
			<SectionContainer category="NEWS & FEATURES" desc="The latest stories on PHS and its community." articles={articles["news-features"]} />
			<hr />
			<br />
			<SectionContainer
				category="OPINIONS"
				desc="Opinions of the student body, from school policies to global issues."
				articles={articles["opinions"]}
			/>
			{/* <div className="dark-banner">
				<div id="dark-banner-content">
					<hr />
					<div style={{ display: "flex", marginLeft: "5vw", marginRight: "5vw", gap: "1rem" }}>
						<Image src="/assets/white-tower.png" width={309} height={721} alt="Tower logo" style={{ width: "15rem", height: "auto" }} />
						<div>
							<h2 style={{ marginTop: "1.5rem", marginBottom: "1.5rem", textAlign: "left" }}>
								The Tower is Princeton High School&apos;s student-run newspaper.
							</h2>
							<p style={{ textAlign: "left", fontSize: "1.5rem" }}>
								Since 1928, the Tower has been reporting on the inner workings of PHS, the district, and the cultural and athletic
								events that affect the student body.
								<br /> <br />
								Each year, the staff produces eight issues to be distributed. Subscribe to have the latest stories delivered to your
								door.
							</p>
						</div>
					</div>
					<hr />
				</div>
			</div> */}
			{/* ^^ this is just... bland? like it pollutes the page and makes it rly uninteresting (maybe its filling in for the page being kinda boring? idk tho :shrug:) */}
			<br />
			<hr />
			<br />
			<SectionContainer category="ARTS & ENTERTAINMENT" desc="Music, theatre, and more." articles={articles["arts-entertainment"]} />
			<hr />
			<br />
			<SectionContainer category="SPORTS" desc="Updates on PHS games, tales of sports history, and more." articles={articles["sports"]} />
			<hr />
			<br />
			<VanguardContainer desc="The most creative section, with the format changing each issue." spreads={vang} />
			<SubBanner title="Consider subscribing to The Tower." />
		</div>
	);
}

function SponsorBanner() {
	return (
		<div className={sponsorStyles.banner}>
			<h1 style={{ marginTop: "2.5rem", fontSize: "clamp(1.2rem, 4vw, 2rem)" }}> Thank you to our sponsors for supporting us!</h1>
			<div className={sponsorStyles["sponsor-list"]}>
				<Link href="https://milkncookies.online/">
					<Image src="/assets/milk-cookies.png" width={2500} height={2500} alt="Milk & Cookies" />
				</Link>
				{/* Add other sponsors here once we get them */}
			</div>
			<i>
				Interested in sponsoring? Contact <Link href="mailto:phstowersenioreditors@gmail.com">phstowersenioreditors@gmail.com</Link> for more
				info
			</i>
		</div>
	);
}

export function Multimedia() {
	return (
		<div className="multimedia">
			<div>
				<section className="category">
					<em>
						<Link href={"/category/multimedia"}>
							<span style={{ margin: "0px", fontFamily: "Open Sans" }}>Multimedia</span>
						</Link>
					</em>
				</section>
				<Video link="GDDGmRkkS5A" title="Soccer Practice with Nick Matese" />
				<Podcast link="1187999" />
			</div>
		</div>
	);
}
