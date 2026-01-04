/** @format */

import styles from "~/lib/styles";
import ArticlePreview from "./preview.client";
import { article, spreads } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";

interface SectionProps {
	category: string;
	desc: string;
	articles: article[];
}

export function SectionContainer({ category, desc, articles }: SectionProps) {
	return (
		<div className={category}>
			<style jsx>{`
				.row-container {
					display: flex;
					gap: 1rem;
					list-style: none;
					overflow-x: scroll;
					scroll-snap-type: x mandatory;
				}

				.item {
					flex-shrink: 0;
					width: 22rem;
					height: 100%;
					background-color: var(--background);
					scroll-snap-align: start;
				}

				/* Uniform card visuals: fixed image area + clamped text */
				:global(.row-container .article-preview.box .preview-image) {
					width: 100% !important;
					height: 13rem !important; /* fixed so all cards equal height */
					object-fit: contain !important; /* show full image */
					margin-left: 0 !important;
					margin-right: 0 !important;
				}
				/* Pull title tight to image by shrinking image wrapper gap */
				:global(.row-container .article-preview.box .img-wrapper) {
					margin-bottom: -1rem !important;
				}
				/* Title directly under image with stable height */
				:global(.row-container .article-preview.box .title) {
					margin-top: 0rem; /* keep title snug under image */
					margin-bottom: 0.3rem;
				}
				/* Clamp title to 2 lines but do not reserve extra space; container below ensures uniform height */
				:global(.row-container .article-preview.box .title .large) {
					display: -webkit-box;
					-webkit-line-clamp: 2;
					-webkit-box-orient: vertical;
					overflow: hidden;
					min-height: 0; /* allow single-line titles without extra gap */
					text-overflow: ellipsis;
				}
				/* Stack title + authors together with a fixed block height so cards align */
				:global(.row-container .article-preview.box .large-preview > div:last-child) {
					display: flex;
					flex-direction: column;
					justify-content: flex-start; /* pack title + authors at top */
					height: 6.5rem; /* fixed block: ~3 lines, leaves empty space below authors if short */
					overflow: hidden;
					gap: 0.15rem;
				}
				/* Authors pinned right under title; anything below is hidden */
				:global(.row-container .article-preview.box .authors) {
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
					min-height: 1.2rem; /* stabilize author line */
				}
				:global(.row-container .article-preview.box .preview-text) {
					display: none !important;
				}

				h3 {
					font-family: ${styles.font.sans};
				}
			`}</style>
			<h3>{category}</h3>
			<p>{desc}</p>
			<ul className="row-container">
				{Object.values(articles).map(article => (
					<li key={article.id} className="item">
						<ArticlePreview key={article.id} style="box" size="large" fit="contain" article={article} />
					</li>
				))}
			</ul>
		</div>
	);
}

interface VangProps {
	desc: string;
	spreads: spreads[];
}

export function VanguardContainer({ desc, spreads }: VangProps) {
	return (
		<div id="vanguard">
			<style jsx>{`
				.row-container {
					display: flex;
					gap: 1rem;
					list-style: none;
					overflow-x: scroll;
					scroll-snap-type: x mandatory;
				}

				.item {
					flex-shrink: 0;
					width: 16rem;
					height: 100%;
					background-color: #fff;
					scroll-snap-align: start;
				}

				h3 {
					font-family: ${styles.font.sans};
				}

				.vang-large-preview {
					background-color: white;
					padding: 10px;
					margin-bottom: 10px;
					border-bottom: 1px solid gainsboro;
				}

				.article-preview > .large-preview:hover {
					background-color: #f0f0f077;
					transition-duration: 0.1s;
				}

				.title a {
					font-size: 1.5rem;
					color: ${styles.color.primary} !important !important !important;
					font-weight: bold;
				}
			`}</style>
			<h3>VANGUARD</h3>
			<p>{desc}</p>
			<ul className="row-container">
				{Object.values(spreads).map(article => (
					<li key={article.id} className="item">
						<div className="vang-large-preview">
							<Image
								src="/assets/white-tower.png"
								width={309}
								height={721}
								alt="Image"
								style={{ width: "16rem", height: "16rem", objectFit: "cover", backgroundColor: "black" }}
							/>
							<section className="title">
								<Link href={article.src} legacyBehavior>
									<a>{article.title}</a>
								</Link>
							</section>
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}
