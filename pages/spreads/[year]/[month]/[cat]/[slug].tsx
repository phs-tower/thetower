/** @format */

import { spreads } from "@prisma/client";
import Head from "next/head";
import { getSpread } from "~/lib/queries";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "~/lib/styles";

interface Props {
	spread: spreads;
}

interface Params {
	params: {
		slug: string;
	};
}

export async function getServerSideProps({ params }: Params) {
	return {
		props: {
			spread: await getSpread(params.slug),
		},
	};
}

export default function SpreadPage({ spread }: Props) {
	const [scrolledPast, setScrolledPast] = useState(false);
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const handleResize = () => {
			setIsMobile(window.innerWidth <= 1000);
		};

		const handleScroll = () => {
			if (!isMobile) {
				setScrolledPast(window.scrollY > 85);
			}
		};

		handleResize();
		window.addEventListener("resize", handleResize);
		window.addEventListener("scroll", handleScroll);

		return () => {
			window.removeEventListener("resize", handleResize);
			window.removeEventListener("scroll", handleScroll);
		};
	}, [isMobile]);

	return (
		<div className="spread">
			<Head>
				<title>{`${spread.title} | The Tower`}</title>
				<meta property="og:title" content={`${spread.title} | The Tower`} />
				<meta property="og:description" content="Read more about this article!" />
			</Head>

			<style jsx>{`
				.spread {
					display: flex;
					flex-direction: column;
					align-items: center;
					padding: 1.25rem;
					position: relative;
				}
				h1 {
					margin-bottom: 1rem;
					text-align: center;
				}
				.pdf-container {
					width: 60vw;
					height: 100vh;
					border: none;
				}
				.category-button {
					border: 2px solid ${styles.color.darkAccent};
					background-color: white;
					color: black;
					padding: 0.3rem 1rem;
					font-size: 1rem;
					font-family: ${styles.font.sans};
					border-radius: 5px;
					transition: 0.25s;
					text-transform: uppercase;
					letter-spacing: 0.05em;
					display: inline-block;
					text-align: center;
					cursor: pointer;
					text-decoration: none;
				}
				.category-button:hover {
					background-color: ${styles.color.darkAccent};
					color: white;
					text-decoration: none;
				}

				@media screen and (max-width: 1000px) {
					.category-label {
						position: static !important;
						text-align: center;
						margin-bottom: 0.6rem;
					}
				}
			`}</style>

			{/* Top-right floating Vanguard category button */}
			<div
				className="category-label"
				style={{
					position: !isMobile && scrolledPast ? "fixed" : "absolute",
					top: !isMobile && scrolledPast ? "4.5rem" : "-1.25rem",
					right: !isMobile && scrolledPast ? "4.5rem" : "1.2rem",
					zIndex: 1000,
				}}
			>
				<Link href="/category/vanguard" legacyBehavior>
					<a className="category-button">VANGUARD ↗</a>
				</Link>
			</div>

			<h1>{spread.title}</h1>
			<div className="pdf-container">
				<object data={spread.src} type="application/pdf" width="100%" height="100%">
					<iframe src={spread.src} width="100%" height="100%" style={{ border: "none" }}>
						This browser does not support PDFs. Please download the PDF to view it: <a href={spread.src}>Download PDF</a>
					</iframe>
				</object>
			</div>
		</div>
	);
}
