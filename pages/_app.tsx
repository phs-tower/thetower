/** @format */

import type { AppProps, NextWebVitalsMetric } from "next/app";
import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import "~/styles/styles.scss";
import styles from "~/lib/styles";
import { useRouter } from "next/router";
import { socialLinks } from "~/lib/constants";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { displayFullDate } from "~/lib/utils";
import { usePathname } from "next/navigation";

import "./global.scss";
import "./nav.scss";

type Subsection = {
	name: string;
	href: string;
};

function SectionLink({ href, name: section, subsections }: { href: string; name: string; subsections?: Subsection[]}) {
	const [open, setOpen] = useState(false);
	return (
		<div className="section-link">
			<div className="section-button">
				<Link href={href}>{section}</Link>
				{ subsections && <div className="bar-vertical"/> }
				{ subsections && <span onClick={e => { e.preventDefault(); setOpen(!open); }}><i className="fa-solid fa-chevron-down" data-open={open}/></span> }
			</div>
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
		</nav>
	);
}

function Masthead() {
	const [issue, setIssue] = useState({ month: 2, year: 2022 });
	const [menuOpen, setMenuOpen] = useState(false);
	const [menuX, setMenuX] = useState(false);
	const router = useRouter();

	// Close sections menu when navigating
	const [startLocation, setStartLocation] = useState(usePathname());
	const path = usePathname();
	if (startLocation != path) {
		setStartLocation(path);
		if (menuOpen) setMenuOpen(false);
	}

	useEffect(() => document.addEventListener("keyup", e => e.key == "Escape" && setMenuOpen(false)));

	let m = new Date().getMonth() + 1;
	let y = new Date().getFullYear();
	const getIssue = async () => {
		if (await pdfExists(m, y)) {
			setIssue({ month: m, year: y });
			return;
		}
		for (let i = 0; i < 12; i++) {
			m--;
			if (m == 0) {
				m = 12;
				y--;
			}
			if (!(await pdfExists(m, y))) continue;
			setIssue({ month: m, year: y });
			return;
		}
	};
	if (issue.year == 2022) getIssue();
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

	if (menuOpen != menuX) {
		setTimeout(() => {
			setMenuX(menuOpen);
		}, 100);
	}

	return (
		<div className="header">
			<Link href="/home" id="masthead">
				<img src="/assets/tower-short.png" draggable="false" />
				<h1 id="masthead-text">The Tower</h1>
			</Link>
			<div className="masthead-sides">
				<div className="left-stuff">
					<div id="paper-info">
						<span>
							<Link href={pdfLink} className="underline-animation">
								PRINT EDITION
							</Link>
						</span>
						<p>{displayFullDate().toUpperCase()}</p>
					</div>
					<button id="menu" data-open={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
						<i className={`fa-solid ${menuX ? "fa-x" : "fa-bars"}`}></i>
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
	const router = useRouter();

	useEffect(() => {
		if (typeof window === "undefined") return;

		const key = `site-tracked:${router.asPath}`;
		if (sessionStorage.getItem(key)) return;
		sessionStorage.setItem(key, "1");

		fetch("/api/track", { method: "POST" }).catch(() => {});
	}, [router.asPath]);

	// Consistent 3.5% side padding on all pages except article pages (leave articles as-is)
	const isArticle = router.pathname.startsWith("/articles");
	// const mainStyle = isArticle
	// 	? ({ maxWidth: "1200px", margin: "0 auto", paddingInline: "1rem" } as const)
	// 	: ({ maxWidth: "100%", margin: 0, paddingInline: "3.5%" } as const);

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

			{/* Center dropdowns under tabs on desktop only */}
			<style jsx global>{`
				@media (min-width: 971px) {
					nav #links .section-link {
						position: relative;
						padding-bottom: 0;
					}
					nav #links .section-link .dropdown {
						position: absolute;
						top: calc(100% - 0.5rem);
						left: 50%;
						transform: translateX(-50%);
						display: none;
						background: #fff;
						border: 1px solid rgba(0, 0, 0, 0.08);
						border-radius: 6px;
						box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
						padding: 0.4rem 0.6rem;
						white-space: nowrap;
						z-index: 1000;
						max-width: calc(100vw - 40px);
					}
					nav #links .section-link:hover .dropdown,
					nav #links .section-link .dropdown:hover {
						display: block;
					}
					nav #links .section-link .dropdown a {
						display: block;
						padding: 0.35rem 0.6rem;
					}
				}
			`}</style>
			<Analytics />
			<SpeedInsights />
		</>
	);
}

function Footer() {
	return (
		<footer>
			<hr />
			<div className="top">
				<div>
					<Link href="/home">
						<h1>The Tower</h1>
					</Link>
					{socialLinks.map(({ name, url, icon }) => {
						const IconComponent = icon as React.ComponentType<{ size?: string }>;
						return (
							<a key={name} href={url} target="_blank" rel="noopener noreferrer" className="socials-icon" aria-label={name}>
								<IconComponent size="2.2em" />
							</a>
						);
					})}
				</div>
				<Link
					href="https://docs.google.com/forms/d/e/1FAIpQLSeine_aZUId0y2OjY2FZyJ93ZliGQZos-6c3VwkPg2IhXsGfg/viewform?usp=sf_link"
					className="home-btn"
				>
					Report problem »
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
				Site by Luke Tong &apos;23, Jieruei Chang &apos;24, Henry Langmack &apos;25, Ayush Shrivastava &apos;25, Anita Ndubisi &apos;26, Om
				Mehta &apos;26, and Aryan Singla &apos;27
			</span>
		</footer>
	);
}

export function reportWebVitals(metric: NextWebVitalsMetric) {
	console.log(metric);
}
