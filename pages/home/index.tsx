/** @format */

import { article, spreads } from "@prisma/client";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
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
					grid-template-areas:
						"left-top center right-top"
						"left-bottom center right-bottom";
					column-gap: 0.2rem;
					row-gap: 1.1rem;
					align-items: start;
				}
				.hero-card hr {
					width: 100%;
					margin: 0 0 0.35rem 0;
				}
				.hero-left-top {
					grid-area: left-top;
				}
				.hero-left-bottom {
					grid-area: left-bottom;
				}
				.hero-center {
					grid-area: center;
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
				.hero-right-top {
					grid-area: right-top;
				}
				.hero-right-bottom {
					grid-area: right-bottom;
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
				@media (max-width: 900px) {
					:global(.mosaic .triple.home-hero .hero-card .article-preview.box .preview-image) {
						max-width: 100% !important;
						max-height: 12rem !important;
						height: 12rem !important;
					}
					:global(.mosaic .triple.home-hero .hero-card .article-preview.box.noimg .preview-image) {
						object-fit: contain !important;
					}
				}
			`}</style>
			<div className="mosaic">
				<div className="triple home-hero">
					<div className="hero-card hero-left-top">
						<hr />
						{articles["opinions"][0] && <ArticlePreview article={articles["opinions"][0]} style="box" size="large" fit="cover" />}
					</div>
					<div className="hero-card hero-left-bottom">
						{leftBottomArticle && <ArticlePreview article={leftBottomArticle} style="box" size="large" fit="cover" />}
					</div>
					<div className="hero-center">
						{volumeLabel ? <div className="hero-issue">{volumeLabel}</div> : null}
						<div className="hero-featured">
							{articles["featured"][0] && <ArticlePreview article={articles["featured"][0]} style="box" size="featured" />}
						</div>
					</div>
					<div className="hero-card hero-right-top">
						<hr />
						{articles["sports"][0] && <ArticlePreview article={articles["sports"][0]} style="box" size="large" fit="cover" />}
					</div>
					<div className="hero-card hero-right-bottom">
						{articles["arts-entertainment"][0] && (
							<ArticlePreview article={articles["arts-entertainment"][0]} style="box" size="large" fit="cover" />
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
