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
					width: 16rem;
					height: 100%;
					background-color: #fff;
					scroll-snap-align: start;
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
						<ArticlePreview key={article.id} style="box" size="large" article={article} />
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
