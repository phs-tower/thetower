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
	/**
	 * Control how thumbnails fit inside their frame. Default is "cover".
	 */
	fit?: "cover" | "contain";
	thumbHeight?: string | number;
	noteBelowImage?: React.ReactNode;
	eyebrow?: React.ReactNode;
	showPreviewText?: boolean;
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

function buildPreviewText(content: string, length: number) {
	const cleaned = content
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (!cleaned) return "";
	if (cleaned.length <= length) return cleaned;
	return shortenText(cleaned, length);
}

export default function ArticlePreview({
	article,
	category,
	style = "row",
	size = "medium",
	shrinkThumb = false,
	fit = "cover",
	thumbHeight,
	noteBelowImage,
	eyebrow,
	showPreviewText = false,
}: Props) {
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
			case "category-list":
				charlen = 220;
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
	const previewText = showPreviewText && charlen > 0 && article.content ? buildPreviewText(article.content, charlen) : "";

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

				.article-eyebrow {
					font-size: 0.8rem;
					font-weight: 700;
					text-transform: uppercase;
					letter-spacing: 0.08em;
					color: ${styles.color.accent};
					margin: 0 0 0.35rem;
					display: block;
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
					color: #666;
					font-size: 0.98rem;
					font-weight: 400;
					line-height: 1.45;
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
					background-color: var(--background);
					padding: 10px;
					margin-bottom: 10px;
					border-bottom: 1px solid gainsboro;
				}
				.article-preview > .large-preview:hover {
					background-color: #f0f0f077;
					transition-duration: 0.1s;
				}

				/* Keep featured text aligned with featured image (now 7% side margins) */
				.featured-preview > div:last-child {
					padding-inline: 1%;
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
					.title .featured {
						font-size: clamp(1.35rem, 4.6vw, 1.65rem);
						-webkit-line-clamp: 4;
					}

					.title .large {
						font-size: clamp(1.08rem, 4vw, 1.3rem);
					}

					.title .small {
						font-size: clamp(0.98rem, 3.6vw, 1.15rem);
					}

					.article-preview.box {
						padding: clamp(0.75rem, 3.25vw, 1.1rem);
						margin-left: clamp(-0.85rem, -3vw, -1.15rem);
						margin-right: clamp(-0.85rem, -3vw, -1.15rem);
					}

					.article-preview.box .img-wrapper {
						margin-right: 0;
						margin-bottom: 0.65rem;
					}

					.article-preview.box .authors {
						font-size: 0.92rem;
						white-space: normal;
					}

					.article-preview.box .preview-image {
						max-width: 106% !important;
						height: auto !important;
						margin-left: -3% !important;
						margin-right: -3% !important;
						border-radius: 0.65rem;
						object-fit: cover !important;
					}

					.article-preview.box.featured {
						margin-left: clamp(-1.25rem, -4.5vw, -1.5rem);
						margin-right: clamp(-1.25rem, -4.5vw, -1.5rem);
						padding: clamp(0.85rem, 3.6vw, 1.25rem);
					}

					.article-preview.box.featured .preview-image {
						max-width: 118% !important;
						max-height: clamp(16rem, 58vw, 20.5rem) !important;
						margin-left: -6.5% !important;
						margin-right: -6.5% !important;
						border-radius: 0.85rem;
					}

					.article-preview.box.large .preview-image {
						max-height: 11.5rem !important;
					}

					.article-preview.box.small .preview-image {
						max-height: 9rem !important;
					}

					.featured-preview > div:last-child {
						padding-inline: clamp(0.9rem, 3.75vw, 1.35rem);
					}

					.article-preview > .category-list-preview {
						display: grid;
						grid-template-columns: 0.6fr 1fr;
						column-gap: 0.8rem;
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

				/* Small gray helper note below images when provided */
				.note-below-image {
					color: #777;
					font-size: 0.9rem;
					margin-top: 0.25rem;
				}

				/* Indent note slightly for featured cards only */
				.article-preview.box.featured .note-below-image {
					margin-left: 0.5rem;
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
							className="preview-image"
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
											height: size == "featured" ? "100%" : thumbHeight ?? "16rem",
											maxWidth: size == "featured" ? "100%" : "100%",
											maxHeight: size == "featured" ? "90%" : typeof thumbHeight !== "undefined" ? thumbHeight : "16rem",
											marginLeft: size == "featured" ? "1%" : "0",
											marginRight: size == "featured" ? "7%" : "0",
											objectFit: fit,
									  }
							}
						/>
					) : (
						<Image
							className="preview-image"
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
									: {
											width: "100%",
											height: size == "featured" ? "100%" : typeof thumbHeight !== "undefined" ? thumbHeight : "16rem",
											maxWidth: size == "featured" ? "100%" : "100%",
											maxHeight: size == "featured" ? "90%" : typeof thumbHeight !== "undefined" ? thumbHeight : "16rem",
											marginLeft: size == "featured" ? "1%" : "0",
											marginRight: size == "featured" ? "7%" : "0",
											objectFit: fit,
											backgroundColor: "black",
									  }
							}
						/>
					)}
				</div>
				{noteBelowImage ? <div className="note-below-image">{noteBelowImage}</div> : null}
				<div>
					{eyebrow ? <div className="article-eyebrow">{eyebrow}</div> : null}
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

					{previewText ? <section className="preview-text">{previewText}</section> : null}
				</div>
			</div>
		</div>
	);
}
