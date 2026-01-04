/** @format */

import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { getCurrArticles } from "~/lib/queries";
import { article } from "@prisma/client";
import ArticlePreview from "~/components/preview.client";
import styles from "~/lib/styles";
import shuffle from "lodash/shuffle";
import { socialLinks } from "~/lib/constants";
import React from "react";

interface Props {
	articles: article[];
}

export async function getServerSideProps() {
	const articles = shuffle(await getCurrArticles());
	return {
		props: { articles },
	};
}

export default function Subscribe({ articles }: Props) {
	const [showSidebar, setShowSidebar] = useState(false);

	return (
		<div className="subscribe-page">
			<Head>
				<title>Subscribe | The Tower</title>
				<meta property="og:title" content="Subscribe | The Tower" />
				<meta property="og:description" content="Subscribe to The Tower newspaper" />
			</Head>

			<style jsx>{`
				.subscribe-page {
					padding: 2.5rem 4rem;
					font-family: ${styles.font.serifText};
				}

				/* grid wrapper for letter + sidebar */
				.grid {
					display: grid;
					grid-template-columns: 1fr clamp(360px, 30vw, 450px);
					gap: 2rem;
					transition: grid-template-columns 0.2s ease;
				}

				.letter {
					max-width: 95%;
					line-height: 2;
					font-size: 17px !important;
				}
				.letter p:not(.contact-note) {
					font-size: inherit !important;
					line-height: 1.4;
					margin-bottom: 1rem;
				}
				.signature {
					margin-top: 1.6rem;
					font-style: italic;
				}
				.price-note {
					margin-top: 1rem;
					margin-bottom: 1rem;
					font-weight: bold;
					font-style: italic;
					font-size: 1rem;
				}
				.contact-note {
					font-size: 15px;
					color: #444;
					margin-top: -1rem;
				}
				.buttons {
					display: flex;
					gap: 1.25rem;
					margin-top: 0.6rem;
				}
				/* Prevent global link hover fade from affecting pay boxes */
				:global(.subscribe-page .buttons a:hover),
				:global(.subscribe-page .buttons a:focus),
				:global(.subscribe-page .buttons a:active) {
					opacity: 1 !important;
				}
				.sub-link {
					border: 2px solid ${styles.color.darkAccent};
					background-color: white;
					color: ${styles.color.darkAccent};
					transition: all 0.2s ease;
					padding: 0.7rem 1.4rem;
					font-family: ${styles.font.sans};
					font-size: 1rem;
					border-radius: 5px;
					text-align: center;
					cursor: pointer;
				}
				.sub-link:hover {
					color: white;
					background-color: ${styles.color.darkAccent};
				}
				/* Mirror hover when hovering the anchor wrapper */
				:global(.subscribe-page .buttons a:hover) .sub-link,
				:global(.subscribe-page .buttons a:focus) .sub-link,
				:global(.subscribe-page .buttons a:active) .sub-link {
					color: white;
					background-color: ${styles.color.darkAccent};
					opacity: 1 !important;
				}

				/* Match nav Subscribe hover on mobile (inverse colors) */
				@media screen and (max-width: 970px) {
					.sub-link:hover {
						color: ${styles.color.darkAccent};
						background-color: white;
					}
					:global(.subscribe-page .buttons a:hover) .sub-link,
					:global(.subscribe-page .buttons a:focus) .sub-link,
					:global(.subscribe-page .buttons a:active) .sub-link {
						color: ${styles.color.darkAccent};
						background-color: white;
					}
				}

				.social-icons {
					display: flex;
					gap: 0.1rem;
					margin-bottom: 1.25rem;
					align-items: center;
				}
				.social-icons a {
					color: inherit;
					transition: transform 0.2s ease;
				}
				.social-icons a:hover {
					transform: scale(1.1);
					opacity: unset;
					color: ${styles.color.darkAccent};
				}

				.sidebar {
					display: flex;
					flex-direction: column;
					border-left: 1px solid #dcdcdc;
					padding-left: 0.6rem;
					margin-top: 0.1rem;
					transition: opacity 0.2s ease, border 0.2s ease;
				}
				.sidebar h2 {
					font-size: 1.25rem;
					margin-bottom: 0.6rem;
					font-family: ${styles.font.serifHeader};
					text-align: left;
				}
				.divider {
					width: 100%;
					height: 1px;
					background: #ccc;
					margin: 1rem 0;
				}

				@media screen and (max-width: 1000px) {
					.subscribe-page {
						padding: 1.25rem 1rem;
					}

					.grid {
						/* collapse or show sidebar */
						grid-template-columns: ${showSidebar ? "2.5fr 1fr" : "1fr 0"};
					}

					.letter {
						max-width: 100%;
					}

					.sidebar {
						opacity: ${showSidebar ? "1" : "0"};
						border-left: ${showSidebar ? "1px solid #dcdcdc" : "none"};
					}
				}
			`}</style>

			{/* mobile â€œShow/Hide Sidebarâ€ button */}

			<div className="grid">
				{/* The letter */}
				<section className="letter">
					<h1>
						<em>The Tower</em> Student Newspaper Subscription
					</h1>

					<div className="social-icons">
						{socialLinks.map(({ name, url, icon }) => {
							// cast to a real component type
							const IconComponent = icon as React.ElementType;
							return (
								<a key={name} href={url} target="_blank" rel="noopener noreferrer" aria-label={name}>
									<IconComponent size="2em" />
								</a>
							);
						})}
					</div>

					<p style={{ marginTop: "1rem" }}>Dear Tower Families, Friends, and Readers,</p>

					<p>
						In the nearly hundred years since its founding in 1928, <em>The Tower</em> has chronicled the story of Princeton High School —
						the big headlines, the quiet uncertainty, the student voices, and all of the moments that continue to make this community a
						home for us. Every issue is written, edited, and designed by students who care deeply about what happens here, and who believe
						that our school’s story is best told by the people living it.
					</p>

					<p>
						We write about what we&apos;re proud of, what might be different, and things we&apos;re still figuring out. We ask questions,
						highlight student creativity, and reflect on what life is like at PHS. It&apos;s a paper by students — for anyone who wants to
						understand them better.
					</p>

					<p>
						By subscribing, you support students who learn to write with a sense of posterity—who speak with the confidence to influence
						what happens next, and who learn to listen and reflect closely on the world around them. You&apos;ll also receive all eight of
						our monthly print issues delivered straight to your door — a year&apos;s worth of our school&apos;s story, arriving one
						chapter at a time.
					</p>

					<p>
						If that sounds like something you want to be part of, and something that seems right to you, we’d be honored, and would love
						to help you learn about our school through stories and experiences. You can subscribe by paying online, by check, or in cash —
						whatever is easiest for you.
					</p>

					<p className="signature">
						With appreciation,
						<br />
						The Editorial Board of <em>The Tower</em>
					</p>

					<p className="price-note">2025-2026 Subscription: $30/year for 8 monthly issues</p>

					<p className="contact-note">
						Contact <u>towerbusiness@gmail.com</u> with any questions.
					</p>

					<div className="buttons">
						<Link href="https://thetower.ludus.com/index.php?sections=payments">
							<p className="sub-link">Pay Online</p>
						</Link>
						<Link href="https://docs.google.com/forms/d/e/1FAIpQLSepzFs9XYC-Dfenzf5Y4xnwfPs5MBzpPhgoRzNYmsBtFAfa5g/viewform">
							<p className="sub-link">Pay with Check or Cash</p>
						</Link>
					</div>
				</section>

				{/* The sidebar */}
				<section className="sidebar">
					<h2>Recent Articles</h2>
					<div className="divider" />
					{articles.map(a => (
						<ArticlePreview key={a.id} article={a} style="row" size="small" category fit="contain" thumbHeight="18rem" />
					))}
				</section>
			</div>
		</div>
	);
}
