/** @format */

import { article } from "@prisma/client";
import Link from "next/link";
import { displayDate, expandCategorySlug, shortenText } from "~/lib/utils";
import CreditLink from "./credit.client";
import styles from "~/lib/styles";
import React, { Fragment } from "react";
import Image from "next/image";

interface Props {
	article: article;
	category?: boolean;
	style?: "box" | "row";
	size?: "small" | "medium" | "large" | "featured" | "category-list";
	/**
	 * If true, render the thumbnail at its natural aspect without stretching,
	 * capped to a smaller max size (used for search results).
	 */
	shrinkThumb?: boolean;
}

// Utility: Extract photographer name from contentInfo
function getPhotographerName(contentInfo?: string | null): string | null {
	if (!contentInfo) return null;

	const firstLine = contentInfo.split("\n")[0];
	if (!firstLine.includes(":")) return null;

	const [label, value] = firstLine.split(":");
	const lower = label.trim().toLowerCase();

	if (lower.includes("photo") || lower.includes("image") || lower.includes("graphic")) {
		return value.trim().split(/\s+/).slice(0, 2).join(" ");
	}

	return null;
}

export default function ArticlePreview({ article, category, style = "row", size = "medium", shrinkThumb = false }: Props) {
	if (!article) return <></>;

	let charlen = 0;
	if (style === "box") {
		// BOX STYLE
		switch (size) {
			case "featured":
				charlen = 200;
				break;

			case "large":
				charlen = 200;
				break;
			// case "medium":
			// 	charlen = 100;
			// 	break;
			// case "small":
			// 	break;

			case "category-list":
				charlen = 200;
		}
	} else {
		// ROW STYLE
		switch (size) {
			case "featured":
				charlen = 250;
				break;

			case "large":
				charlen = 250;
				break;
			// case "medium":
			// 	charlen = 150;
			// 	break;
			// case "small":
			// 	break;
		}
	}

	let showimg = "";
	if (!article.img?.includes(".")) showimg = "noimg"; // article.img = "/assets/default.png";

	return (
		<div className={"article-preview " + style + " " + size + " " + showimg}>
			<style jsx>{`
				.article-preview a:hover {
					text-decoration: underline;
				}
				.article-preview.box {
					display: grid;
					padding: 1px;
					border: none;
					position: relative;
					overflow: hidden; /* avoid title hover/underline bleeding across cards */
				}
				.article-preview.box.small {
					display: grid;
					padding: 1px;
					border: none;
				}
				.article-preview.row {
					padding-bottom: 2vh;
					margin-bottom: 2vh;
					border: none;
					border-bottom: 1px solid gainsboro;
					// grid-template-columns: 1fr 1.5fr;
					grid-gap: 1vw;
					position: relative;
					overflow: hidden; /* avoid hover artifacts */
				}
				.article-preview.row.small {
					display: grid;
					// grid-template-columns: 1fr 1.5fr;
				}

				.article-preview .row .category-list {
					display: grid;
					grid-template-columns: 0.5fr;
				}

				// .img-container {
				// 	position: relative;
				// 	max-width: 100%;
				// 	max-height: 100%;
				// }
				// .img-container.row.large {
				// 	width: 32vw;
				// }
				// .img-container.row.medium {
				// 	width: 12vw;
				// }
				// .img-container.row.small {
				// 	width: 10vw;
				// }

				.img-wrapper .category-list {
					width: 20vw;
				}

				span {
					margin-left: 1vw;
					/* font-size: smaller; */
				}
				.title {
					/* font-weight: 1000;
					font-family: ${styles.font.serifHeader}, sans-serif; */
					font-weight: bold;
				}

				.title a {
					line-height: 1.1; /* prevent hover underline from overlapping neighbors */
				}

				.title a:hover {
					opacity: 0.7;
					transition-duration: 0.25s;
				}

				.title .featured {
					/* font-family: ${styles.font.serifHeader}, sans-serif; */
					font-size: 2rem; /* slightly smaller */
					color: ${styles.color.primary} !important !important !important;
					display: -webkit-box;
					-webkit-line-clamp: 3;
					-webkit-box-orient: vertical;
					overflow: hidden;
				}

				@media (max-width: 1000px) {
					.title .featured {
						/* font-size: x-large; */
					}
				}

				.title .large {
					/* font-family: ${styles.font.serifHeader}, sans-serif; */
					font-size: 1.3rem; /* slightly smaller */
					color: ${styles.color.primary} !important !important !important;
					display: -webkit-box;
					-webkit-line-clamp: 2;
					-webkit-box-orient: vertical;
					overflow: hidden;
				}
				.title .medium {
					/* font-family: ${styles.font.serifHeader}, sans-serif;
					font-size: medium; */
					color: ${styles.color.accent} !important !important !important;
				}
				.title .small {
					/* font-family: ${styles.font.serifHeader}, sans-serif;
					font-size: small; */
				}

				.title .category-list {
					font-size: 1.5rem;
				}

				.category {
					/* font-size: 12pt; */
					margin-bottom: 1vh;
					margin-top: 1vh;
				}
				.preview-text {
					/* font-family: ${styles.font.serifText}, ${styles.font.stack}; */
					margin-top: 1vh;
					margin-bottom: 2vh;
				}
				img {
					width: 100%;
					background-color: #f7f7f7;
					border-radius: 0px;
					box-shadow: 0px 5px 12px #00000022;
				}
				.authors {
					font-size: 1.1rem; /* slightly smaller */
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}
				.article-preview > .large-preview {
					background-color: white;
					padding: 10px;
					margin-bottom: 10px;
					border-bottom: 1px solid gainsboro;
				}
				.article-preview > .large-preview:hover {
					background-color: #f0f0f077;
					transition-duration: 0.1s;
				}

				/* Keep featured text aligned with featured image (image has 5% side margins) */
				.featured-preview > div:last-child {
					padding-inline: 5%;
				}
				.article-preview > .medium-preview {
					display: contents;
				}
				.article-preview > .small-preview {
					display: contents;
				}

				.article-preview > .category-list-preview {
					display: grid;
					grid-template-columns: 2fr 5fr;
				}

				@media (max-width: 1000px) {
					.article-preview > .category-list-preview {
						display: grid;
						grid-template-columns: 0.5fr 1fr;
					}
				}

				.noimg {
					display: grid;
					grid-template-columns: 1fr !important;
				}

				/* Only add side margin in row layout; boxes should be flush */
				.article-preview.row .img-wrapper {
					margin-right: 1.25rem;
				}
				.article-preview.box .img-wrapper {
					margin-right: 0;
				}
			`}</style>
			<div className={size + "-preview"}>
				{/* <div className="img-wrapper">
					{!article.img?.includes(".") ? <></> : <img src={article.img} className={size}></img>}
				</div> */}
				<div className="img-wrapper">
					{" "}
					{article.img?.includes(".") ? (
						<Image
							src={article.img}
							width={1000}
							height={1000}
							alt="Image"
							style={
								shrinkThumb
									? {
											width: "auto",
											height: "auto",
											maxWidth: "180px",
											maxHeight: "120px",
											objectFit: "contain",
									  }
									: {
											width: "100%",
											height: size == "featured" ? "100%" : "16rem",
											maxWidth: size == "featured" ? "90%" : "100%",
											maxHeight: size == "featured" ? "90%" : "16rem",
											marginLeft: size == "featured" ? "5%" : "0",
											marginRight: size == "featured" ? "5%" : "0",
											objectFit: "cover",
									  }
							}
						/>
					) : (
						<Image
							src="/assets/white-tower.png"
							width={309}
							height={721}
							alt="Image"
							style={
								shrinkThumb
									? {
											width: "auto",
											height: "auto",
											maxWidth: "180px",
											maxHeight: "120px",
											objectFit: "contain",
											backgroundColor: "black",
									  }
									: { width: "16rem", height: "16rem", objectFit: "cover", backgroundColor: "black" }
							}
						/>
					)}
				</div>
				<div>
					<section className="category">
						{category && (
							<Link href={"/category/" + article.category}>
								<span style={{ margin: "0px", fontFamily: styles.font.sans }}>{expandCategorySlug(article.category)}</span>
							</Link>
						)}
					</section>
					<section className="title">
						<Link
							href={`/articles/${article.year}/${article.month}/${article.category}/${article.title
								.replaceAll(" ", "-")
								.replaceAll(/[^0-9a-z\-]/gi, "")}-${article.id}`}
							legacyBehavior
						>
							<a className={size}>{article.title}</a>
						</Link>
					</section>

					<section className="authors">
						{article.authors?.map((author, index) => (
							<Fragment key={index}>
								{" "}
								{/* Use a unique identifier if available, otherwise fallback to index */}
								<CreditLink author={author} />
								{index < article.authors.length - 1 && <span style={{ marginLeft: "5px", marginRight: "5px" }}> • </span>}
							</Fragment>
						))}
					</section>

					{/* <section className="preview-text">{shortenText(article.content, charlen)}</section> */}
				</div>
			</div>
		</div>
	);
}
