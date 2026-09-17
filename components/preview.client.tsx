/** @format */

import { article } from "@prisma/client";
import Link from "next/link";
import { displayDate, expandCategorySlug, shortenText } from "~/lib/utils";
import CreditLink from "./credit.client";
import styles from "~/lib/styles";
import React, { Fragment, useEffect, useState } from "react";
import Image from "next/image";

export type PreviewArticle = article & { href?: string };

interface Props {
	article: PreviewArticle;
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
	previewTextBelowImage?: boolean;
	showIssueDate?: boolean;
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
	previewTextBelowImage = false,
	showIssueDate = false,
}: Props) {
	const [imageLoaded, setImageLoaded] = useState(false);
	const imageKey = article?.img || "__tower-fallback__";

	useEffect(() => {
		setImageLoaded(false);
	}, [imageKey]);

	if (!article) return <></>;

	const previewLength = (
		style === "box"
			? { featured: 240, large: 200, "category-list": 200, medium: 0, small: 0 }
			: { featured: 250, large: 250, "category-list": 220, medium: 0, small: 0 }
	)[size];
	const hasArticleImage = Boolean(article.img?.includes("."));
	const isFeatured = size === "featured";
	let previewText = "";
	if (showPreviewText && previewLength > 0 && article.content) {
		previewText = article.content
			.replace(/<[^>]*>/g, " ")
			.replace(/\s+/g, " ")
			.trim();
		if (previewText.length > previewLength) previewText = shortenText(previewText, previewLength);
	}

	let imageSizes = "(max-width: 900px) 100vw, 33vw";
	if (shrinkThumb) {
		imageSizes = "(max-width: 900px) 45vw, 180px";
	} else if (style === "box") {
		if (isFeatured) imageSizes = "(max-width: 1000px) 100vw, 58vw";
		else if (size === "large") imageSizes = "(max-width: 1000px) 100vw, 24vw";
		else if (size === "small") imageSizes = "(max-width: 1000px) 100vw, 18vw";
	} else {
		if (size === "category-list") imageSizes = "(max-width: 900px) 100vw, 34vw";
		else if (size === "small") imageSizes = "(max-width: 900px) 42vw, 16vw";
		else if (size === "large" || isFeatured) imageSizes = "(max-width: 900px) 100vw, 40vw";
	}
	const href =
		article.href ??
		`/articles/${article.year}/${article.month}/${article.category}/${article.title.replaceAll(" ", "-").replaceAll(/[^0-9a-z\-]/gi, "")}-${
			article.id
		}`;

	return (
		<div className={`article-preview ${style} ${size} ${hasArticleImage ? "" : "noimg"}`}>
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
				.preview-image {
					opacity: 0;
					transform: translate3d(0, 6px, 0);
					transition: opacity 240ms ease, transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
				}
				.preview-image.is-loaded {
					opacity: 1;
					transform: translate3d(0, 0, 0);
				}
				@media (prefers-reduced-motion: reduce) {
					.preview-image,
					.preview-image.is-loaded {
						opacity: 1;
						transform: none;
						transition: none;
					}
				}
				.authors {
					font-size: 1.1rem; /* slightly smaller */
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}
				.issue-date {
					margin-top: 0.55rem;
					color: #8a8a8a;
					font-size: 0.98rem;
					font-family: ${styles.font.sans};
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
				.featured-preview > .content-block {
					padding-inline: 1%;
				}
				.article-preview.box.featured > .featured-preview {
					display: flex;
					flex-direction: column;
				}
				.article-preview.box.featured > .featured-preview > .img-wrapper {
					order: 2;
				}
				.article-preview.box.featured > .featured-preview > .content-block {
					order: 1;
				}
				.article-preview.box.featured > .featured-preview > .note-below-image {
					order: 3;
				}
				.article-preview.box.featured > .featured-preview > .preview-text-below-image {
					order: 4;
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

					.featured-preview > .content-block {
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
				<div className="img-wrapper">
					{" "}
					<Image
						className={`preview-image${imageLoaded ? " is-loaded" : ""}`}
						src={hasArticleImage ? article.img! : "/assets/white-tower.png"}
						width={hasArticleImage ? 1000 : 309}
						height={hasArticleImage ? 1000 : 721}
						alt="Image"
						sizes={imageSizes}
						priority={style === "box" && isFeatured}
						onLoad={() => setImageLoaded(true)}
						style={{
							...(shrinkThumb
								? { width: "auto", height: "auto", maxWidth: "180px", maxHeight: "120px", objectFit: "contain" }
								: {
										width: "100%",
										height: isFeatured ? "100%" : thumbHeight ?? "16rem",
										maxWidth: "100%",
										maxHeight: isFeatured ? "100%" : thumbHeight ?? "16rem",
										marginLeft: isFeatured ? "1%" : "0",
										marginRight: isFeatured ? "7%" : "0",
										objectFit: fit,
								  }),
							...(!hasArticleImage ? { backgroundColor: "black" } : {}),
						}}
					/>
				</div>
				{noteBelowImage ? <div className="note-below-image">{noteBelowImage}</div> : null}
				{previewText && previewTextBelowImage ? <section className="preview-text preview-text-below-image">{previewText}</section> : null}
				<div className="content-block">
					{eyebrow ? <div className="article-eyebrow">{eyebrow}</div> : null}
					<section className="category">
						{category && (
							<Link href={"/category/" + article.category}>
								<span style={{ margin: "0px", fontFamily: styles.font.sans }}>{expandCategorySlug(article.category)}</span>
							</Link>
						)}
					</section>
					{showIssueDate ? <section className="issue-date">{displayDate(article.year, article.month)}</section> : null}
					<section className="title">
						<Link href={href} legacyBehavior>
							<a className={size}>{article.title}</a>
						</Link>
					</section>

					<section className="authors">
						{article.authors?.map((author, index) => (
							<Fragment key={index}>
								{" "}
								<CreditLink author={author} />
								{index < article.authors.length - 1 && <span style={{ marginLeft: "5px", marginRight: "5px" }}> • </span>}
							</Fragment>
						))}
					</section>

					{previewText && !previewTextBelowImage ? <section className="preview-text">{previewText}</section> : null}
				</div>
			</div>
		</div>
	);
}
