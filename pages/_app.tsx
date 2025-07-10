/** @format */

import type { AppProps, NextWebVitalsMetric } from "next/app";
import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react"; // <-- ADDED for useEffect, useState
import Button from "~/components/button.client";
import "~/styles/styles.scss";
import styles from "~/lib/styles";
import { useRouter } from "next/router";
import { socialLinks } from "~/lib/constants";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { displayFullDate } from "~/lib/utils";

import "./global.scss";

export default function App({ Component, pageProps }: AppProps) {
	return (
		<>
			<Head>
				<title>Home | The Tower</title>
				<meta name="viewport" content="width=device-width, initial-scale=1" />
			</Head>
			<Banner />
			<NavBar />
			<main className="content">
				<Component {...pageProps} />
			</main>
			<SpeedInsights />
			<Analytics />
			<Footer />
		</>
	);
}

// ======================
// REPLACED BANNER BELOW
// ======================
function Banner() {
	// We’ll check the current month first
	const currentMonth = new Date().getMonth() + 1; // 1-based
	const currentYear = new Date().getFullYear();

	// We'll store the "best available" issue in state
	const [issue, setIssue] = useState<{ month: number; year: number } | null>(null);

	useEffect(() => {
		// HEAD request to see if a PDF exists
		async function pdfExists(month: number, year: number) {
			const url = `https://yusjougmsdnhcsksadaw.supabase.co/storage/v1/object/public/prints/${month}-${year}.pdf`;
			try {
				const res = await fetch(url, { method: "HEAD" });
				return res.ok;
			} catch (err) {
				return false;
			}
		}

		async function findLatestIssue(month: number, year: number) {
			let m = month;
			let y = year;
			// Check up to 24 months in the past
			for (let i = 0; i < 24; i++) {
				const found = await pdfExists(m, y);
				if (found) {
					return { month: m, year: y };
				}
				// If not found, go back 1 month
				if (m === 1) {
					m = 12;
					y--;
				} else {
					m--;
				}
			}
			return null;
		}

		findLatestIssue(currentMonth, currentYear).then(res => {
			if (res) setIssue(res);
		});
	}, [currentMonth, currentYear]);

	// Build the final PDF link from the found issue or "#" if none found
	const pdfLink = issue ? `https://yusjougmsdnhcsksadaw.supabase.co/storage/v1/object/public/prints/${issue.month}-${issue.year}.pdf` : "#";

	return (
		<div className="banner">
			<div className="sub">
				<Link href="/subscribe">
					<span style={{ color: styles.color.accent, cursor: "pointer", fontFamily: styles.font.sans, fontSize: "1.6rem" }}>SUBSCRIBE</span>
				</Link>
				<br />
				<Link href={pdfLink}>
					<span style={{ color: styles.color.accent, cursor: "pointer", fontFamily: styles.font.sans, fontSize: "1.6rem" }}>
						PRINT EDITION
					</span>
				</Link>
				<br />
				<span style={{ fontFamily: styles.font.sans, color: styles.color.accent, fontSize: "1.6rem" }}>
					{displayFullDate().toUpperCase()}
				</span>
			</div>

			<div className="search">
				<input
					type="text"
					placeholder="Search"
					onKeyDown={e => {
						if (e.key === "Enter") {
							window.location.href = "/search/" + document.getElementsByTagName("input")[0].value;
						}
					}}
				/>
				<button
					onClick={() => {
						window.location.href = "/search/" + document.getElementsByTagName("input")[0].value;
					}}
				>
					🔎︎
				</button>
			</div>

			<div className="image">
				<Link href="/home">
					<h1 id="big-title">The Tower</h1>
				</Link>
				<p
					style={{
						fontFamily: styles.font.sans,
						fontSize: "1.5rem",
						textAlign: "center",
						color: styles.color.accent,
						marginTop: "-8px",
						marginBottom: "5px",
						fontWeight: 700,
					}}
				>
					Telling Stories Since 1928.
				</p>
			</div>
		</div>
	);
}

// ======================
// FOOTER & NAVBAR BELOW
// ======================
function Footer() {
	return (
		<footer>
			<hr />
			<div className="top">
				<h1>The Tower</h1>
				{socialLinks.map(({ name, url, icon }) => {
					// locally cast it to a component that accepts a `size` prop
					const IconComponent = icon as React.ComponentType<{ size?: string }>;
					const iconSize = ["YouTube", "Spotify", "Apple Podcasts"].includes(name) ? "3.5rem" : "2.2em";

					return (
						<a key={name} href={url} target="_blank" rel="noopener noreferrer" aria-label={name}>
							<IconComponent size={iconSize} />
						</a>
					);
				})}

				<Link
					href="https://docs.google.com/forms/d/e/1FAIpQLSeine_aZUId0y2OjY2FZyJ93ZliGQZos-6c3VwkPg2IhXsGfg/viewform?usp=sf_link"
					legacyBehavior
				>
					<a className="home-btn">Report problem »</a>
				</Link>
			</div>
			<div className="bottom">
				<div>
					<b>
						<Link style={{ fontFamily: styles.font.serifHeader }} href="/category/news-features">
							NEWS & FEATURES
						</Link>
						<br />
					</b>
					<Link href="/category/news-features/phs-profiles">PHS Profiles</Link>
					<br />
				</div>
				<div>
					<b>
						<Link style={{ fontFamily: styles.font.serifHeader }} href="/category/opinions">
							OPINIONS
						</Link>
						<br />
					</b>
					<Link href="/category/opinions/editorials">Editorials</Link>
					<br />
					<Link href="/category/opinions/cheers-jeers">Cheers & Jeers</Link>
					<br />
				</div>
				<div>
					<b>
						<Link style={{ fontFamily: styles.font.serifHeader }} href="/category/vanguard">
							VANGUARD
						</Link>
						<br />
					</b>
					<Link href="/category/vanguard/random-musings">Random Musings</Link>
					<br />
					<Link href="/category/vanguard/spreads">Spreads</Link>
					<br />
				</div>
				<div>
					<b>
						<Link style={{ fontFamily: styles.font.serifHeader }} href="/category/arts-entertainment">
							ARTS & ENTERTAINMENT
						</Link>
						<br />
					</b>
					<Link href="/category/arts-entertainment/student-artists">Student Artists</Link>
					<br />
				</div>
				<div>
					<b>
						<Link style={{ fontFamily: styles.font.serifHeader }} href="/category/sports">
							SPORTS
						</Link>
						<br />
					</b>
					<Link href="/category/sports/student-athletes">Student Athletes</Link>
				</div>
			</div>
			<hr />
			<span>© 2017-2025 The Tower</span>
			<span>
				Site by Luke Tong &apos;23, Jieruei Chang &apos;24, Henry Langmack &apos;25, Ayush Shrivastava &apos;25, Anita Ndubisi &apos;26, and
				Aryan Singla &apos;27
			</span>
		</footer>
	);
}

function NavBar() {
	const router = useRouter();

	// on mount, prefetch all category pages
	useEffect(() => {
		[
			"/category/news-features",
			"/category/multimedia",
			"/category/opinions",
			"/category/vanguard",
			"/category/arts-entertainment",
			"/category/sports",
		].forEach(path => {
			router.prefetch(path);
			// lowk would be better to just prefetch on intent (i.e. put prefetch="intent" on each nav link) unless prefetch ignores images (rn it eats ram)
		});
	}, [router]);

	return (
		<nav>
			<Button
				name="☰"
				href="#"
				className="showMenu"
				onClick={() => {
					const menu = document.querySelector(".menu");
					if (menu) menu.classList.toggle("show");
					// omg i cant decide if i love this or hate it
				}}
			/>
			<div className="menu">
				<Button name="NEWS & FEATURES" href="/category/news-features">
					<Link href="/category/news-features/phs-profiles">PHS Profiles</Link>
				</Button>

				<Button name="MULTIMEDIA" href="/category/multimedia" />

				<Button name="OPINIONS" href="/category/opinions">
					<Link href="/category/opinions/editorials">Editorials</Link>
					<hr />
					<Link href="/category/opinions/cheers-jeers">Cheers & Jeers</Link>
				</Button>

				<Button name="VANGUARD" href="/category/vanguard">
					<Link href="/category/vanguard">Spreads</Link>
					<hr />
					<Link href="/category/vanguard/vanguard">Articles</Link>
				</Button>

				<Button name="ARTS & ENTERTAINMENT" href="/category/arts-entertainment">
					<Link href="/category/arts-entertainment/student-artists">Student Artists</Link>
				</Button>

				<Button name="SPORTS" href="/category/sports">
					<Link href="/category/sports/student-athletes">Student Athletes</Link>
				</Button>

				{/* <Button name="CROSSWORD" href="/games/crossword">
					<Link href="/games/crossword/archive">Past Crosswords</Link>
				</Button> */}

				<Button name="ABOUT" href="/about">
					<Link href="/about/2025">2025 Staff</Link>
					<hr />
					<Link href="/about/2024">2024 Staff</Link>
					<hr />
					<Link href="/about/2023">2023 Staff</Link>
					<hr />
					<Link href="/about/2022">2022 Staff</Link>
				</Button>

				<Button name="ARCHIVES" href="/archives">
					{/* <Link href="/category/special/nsi">New Student Issues</Link> */}
				</Button>
			</div>
		</nav>
	);
}

export function reportWebVitals(metric: NextWebVitalsMetric) {
	console.log(metric);
}
