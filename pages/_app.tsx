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
import "./nav.scss";

type Subsection = {
	name: string;
	href: string;
};

function SectionLink({ href, name: section, subsections }: { href: string; name: string; subsections?: Subsection[] }) {
	return (
		<div className="section-link">
			<Link href={href}>
				{section}
				{subsections && <i className="fa-solid fa-chevron-down" />}
			</Link>
			{subsections && (
				<div className="dropdown">
					{subsections.map((subsection, i) => (
						<Link key={i} href={subsection.href}>
							{subsection.name}
						</Link>
					))}
				</div>
			)}
		</div>
	);
}

export function Nav() {
	return (
		<nav>
			<div className="nav-inner section">
				<Masthead />
				<div id="links">
					<SectionLink
						href="/category/news-features"
						name="NEWS & FEATURES"
						subsections={[{ name: "PHS Profiles", href: "/category/news-features/phs-profiles" }]}
					/>
					<SectionLink href="/category/multimedia" name="MULTIMEDIA" />
					<SectionLink
						href="/category/opinions"
						name="OPINIONS"
						subsections={[
							{ name: "Editorials", href: "/category/opinions/editorials" },
							{ name: "Cheers & Jeers", href: "/category/opinions/cheers-jeers" },
						]}
					/>
					<SectionLink href="/category/vanguard" name="VANGUARD" />
					<SectionLink
						href="/category/arts-entertainment"
						name="ARTS & ENTERTAINMENT"
						subsections={[{ name: "Student Artists", href: "/category/arts-entertainment/student-artists" }]}
					/>
					<SectionLink
						href="/category/sports"
						name="SPORTS"
						subsections={[{ name: "Student Athletes", href: "/category/sports/student-athletes" }]}
					/>
					<SectionLink
						href="/about"
						name="ABOUT"
						subsections={[
							{ name: "2025 Staff", href: "/about/2025" },
							{ name: "2024 Staff", href: "/about/2024" },
							{ name: "2023 Staff", href: "/about/2023" },
							{ name: "2022 Staff", href: "/about/2022" },
						]}
					/>
					<SectionLink href="/archives" name="ARCHIVES" />
				</div>
			</div>
		</nav>
	);
}

function Masthead() {
	const [issue, setIssue] = useState({ month: 2, year: 2022 });

	const router = useRouter();
	// We’ll check the current month first
	let m = new Date().getMonth();
	let y = new Date().getFullYear();

	pdfExists(m, y).then(async res => {
		if (res) {
			setIssue({ month: m, year: y });
			return;
		}
		while (!(await pdfExists(m, y))) {
			m--;
			if (m == 0) {
				m = 12;
				y--;
			}
		}
		setIssue({ month: m, year: y });
	});

	async function pdfExists(month: number, year: number) {
		const url = `https://yusjougmsdnhcsksadaw.supabase.co/storage/v1/object/public/prints/${month}-${year}.pdf`;
		try {
			const res = await fetch(url, { method: "HEAD" });
			return res.ok;
		} catch (err) {
			return false;
		}
	}

	const pdfLink = `https://yusjougmsdnhcsksadaw.supabase.co/storage/v1/object/public/prints/${issue.month}-${issue.year}.pdf`;

	return (
		<div className="header">
			<Link href="/home" id="masthead">
				<img src="/assets/tower-short.png" draggable="false" />
				<h1 id="masthead-text">The Tower</h1>
			</Link>
			<div className="masthead-sides">
				<div className="left-stuff">
					<div id="paper-info">
						<Link href={pdfLink}>Print Edition</Link>
						<p>{displayFullDate().toUpperCase()}</p>
					</div>
					<button id="menu">
						<i className="fa-solid fa-bars"></i>
						<span>Sections</span>
					</button>
				</div>
				<div className="right-stuff">
					<button className="subscribe" onClick={() => router.push("/subscribe")}>
						<span>Subscribe</span>
					</button>
					<div className="search-box">
						<input
							type="text"
							placeholder="Search"
							onKeyDown={e => {
								if (e.key === "Enter") {
									router.push(`/search/${document.querySelector("input")?.value}`);
								}
							}}
						/>
						<button
							onClick={() => {
								router.push(`/search/${document.querySelector("input")?.value}`);
							}}
						>
							<i className="fa-solid fa-search"></i>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

export default function App({ Component, pageProps }: AppProps) {
	return (
		<>
			<Head>
				<title>Home | The Tower</title>
				<meta name="viewport" content="width=device-width, initial-scale=1" />
			</Head>
			{/* <Banner /> */}
			<Nav />
			<main className="content">
				<Component {...pageProps} />
			</main>
			<Footer />
		</>
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

					return (
						<a key={name} href={url} target="_blank" rel="noopener noreferrer" aria-label={name}>
							<IconComponent size="2.2em" />
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
