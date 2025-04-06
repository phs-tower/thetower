/** @format */

import Head from "next/head";
import Link from "next/link";
import { getCurrArticles } from "~/lib/queries";
import { article } from "@prisma/client";
import ArticlePreview from "~/components/preview.client";
import styles from "~/lib/styles";
import shuffle from "lodash/shuffle";

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
	return (
		<div className="subscribe-page">
			<Head>
				<title>Subscribe | The Tower</title>
				<meta property="og:title" content="Subscribe | The Tower" />
				<meta property="og:description" content="Subscribe to The Tower newspaper" />
			</Head>

			<style jsx>{`
				.subscribe-page {
					display: grid;
					grid-template-columns: 2.5fr 1fr;
					gap: 4rem;
					padding: 4rem 6rem;
					font-family: ${styles.font.serifText};
				}

				.letter {
					max-width: 95%;
					font-size: 1rem;
					line-height: 2;
				}

				h1 {
					font-size: 2.8rem;
					font-weight: 700;
					margin-bottom: 1.7rem;
				}

				p {
					margin-bottom: 1.4rem;
				}

				.signature {
					margin-top: 2.5rem;
					font-style: italic;
				}

				.price-note {
					font-weight: bold;
					font-style: italic;
					margin-top: 1.5rem;
					margin-bottom: 1.5rem;
					font-size: 1.2rem;
				}

				.buttons {
					display: flex;
					gap: 2rem;
					margin-top: 1rem;
				}

				.sub-link {
					border: 2px solid ${styles.color.darkAccent};
					background-color: white;
					color: black;
					transition: 0.25s;
					padding: 0.9rem 1.8rem;
					font-family: ${styles.font.sans};
					font-size: 1.3rem;
					border-radius: 5px;
					text-align: center;
				}

				.sub-link:hover {
					color: white;
					background-color: ${styles.color.darkAccent};
				}

				.sidebar {
					display: flex;
					flex-direction: column;
					border-left: 1px solid #dcdcdc;
					padding-left: 1.5rem;
					margin-top: 0.2rem;
				}

				.sidebar h2 {
					font-size: 2rem;
					margin-bottom: 1rem;
					font-family: ${styles.font.serifHeader};
					text-align: left;
				}

				.divider {
					width: 100%;
					height: 1px;
					background: #ccc;
					margin: 1.5rem 0;
				}
			`}</style>

			<section className="letter">
				<h1>
					<em>The Tower</em> Student Newspaper Subscription
				</h1>

				<p>Dear Tower Families, Friends, and Readers,</p>

				<p>
					Since 1928, <em>The Tower</em> has told the story of Princeton High School — not just the big headlines, but the quiet changes,
					the student voices, and the moments that make this community feel like home. Every issue is written, edited, and designed by
					students who care deeply about what happens here.
				</p>

				<p>
					We write about things we’re proud of, and things we’re still figuring out. We ask questions, highlight student creativity, and try
					to reflect what life at PHS really feels like. It’s a paper by students — for anyone who wants to understand them better.
				</p>

				<p>
					When you subscribe, you’re not just supporting a school newspaper — you’re helping students learn how to write with purpose, speak
					with confidence, and listen closely to the world around them. In return, you’ll receive all eight of our monthly print issues
					delivered straight to your door — a window into the rhythm of the school year and the voices that shape it.
				</p>

				<p>
					If that sounds like something you want to be part of, we’d be honored. You can subscribe by paying online or by check or cash —
					whatever’s easier for you.
				</p>

				<p className="signature">
					With appreciation,
					<br />
					The Editorial Board of <em>The Tower</em>
				</p>

				<p className="price-note">2024–25 Subscription: $30/year for 8 monthly issues</p>

				<div className="buttons">
					<Link href="https://thetower.ludus.com/index.php?sections=payments">
						<p className="sub-link">Pay with Card</p>
					</Link>
					<Link href="https://docs.google.com/forms/d/e/1FAIpQLSepzFs9XYC-Dfenzf5Y4xnwfPs5MBzpPhgoRzNYmsBtFAfa5g/viewform">
						<p className="sub-link">Pay with Check or Cash</p>
					</Link>
				</div>
			</section>

			<section className="sidebar">
				<h2>Recent Articles</h2>
				<div className="divider" />
				{articles.map(article => (
					<ArticlePreview key={article.id} article={article} style="row" size="small" category />
				))}
			</section>
		</div>
	);
}
