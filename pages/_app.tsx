/** @format */

import type { AppProps, NextWebVitalsMetric } from "next/app";
import Head from "next/head";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import "~/styles/styles.scss";
import styles from "~/lib/styles";
import { useRouter } from "next/router";
import { socialLinks } from "~/lib/constants";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { warmSearchIndex } from "~/lib/search-client";
import { displayFullDate } from "~/lib/utils";
import { staffMenuItems } from "~/lib/staff";

import "./global.scss";
import "./nav.scss";

const STAFF_YEARS_CACHE_KEY = "tower:staff-years";
const PRINT_ISSUE_CACHE_KEY = "tower:latest-print-issue";
const SITE_VISIT_TRACKED_KEY = "tower:site-visit-tracked";
const PromoPopup = dynamic(() => import("~/components/promo-popup.client"), { ssr: false, loading: () => null });

type Subsection = {
	name: string;
	href: string;
};

function buildStaffMenuItems(years: number[]) {
	return years.map(year => ({ name: `${year} Staff`, href: `/about/${year}` }));
}

function SectionLink({ href, name: section, subsections }: { href: string; name: string; subsections?: Subsection[] }) {
	const [open, setOpen] = useState(false);
	return (
		<div className="section-link">
			<div className="section-button">
				<Link href={href}>{section}</Link>
				{subsections && <div className="bar-vertical" />}
				{subsections && (
					<span
						onClick={e => {
							e.preventDefault();
							setOpen(!open);
						}}
					>
						<i className="fa-solid fa-chevron-down" data-open={open} />
					</span>
				)}
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
	const [aboutSubsections, setAboutSubsections] = useState(staffMenuItems);

	useEffect(() => {
		if (staffMenuItems.length > 0) return;
		let cancelled = false;
		const refreshStaffYears = async () => {
			try {
				const cached = sessionStorage.getItem(STAFF_YEARS_CACHE_KEY);
				if (cached) {
					const years = JSON.parse(cached) as number[];
					if (!cancelled && Array.isArray(years) && years.length > 0) {
						setAboutSubsections(buildStaffMenuItems(years));
						return;
					}
				}

				const res = await fetch("/api/staff-years");
				if (!res.ok) return;
				const payload = (await res.json()) as { years?: number[] };
				if (!cancelled && Array.isArray(payload.years)) {
					sessionStorage.setItem(STAFF_YEARS_CACHE_KEY, JSON.stringify(payload.years));
					setAboutSubsections(buildStaffMenuItems(payload.years));
				}
			} catch {
				/* noop */
			}
		};
		refreshStaffYears();
		return () => {
			cancelled = true;
		};
	}, []);

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
				<SectionLink href="/category/vanguard" name="VANGUARD" subsections={[{ name: "Articles", href: "/category/vanguard/articles" }]} />
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
				<SectionLink href="/games/crossword" name="CROSSWORDS" />
				<SectionLink href="/about" name="ABOUT" subsections={aboutSubsections} />
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
	const searchInputRef = useRef<HTMLInputElement>(null);

	const submitSearch = (e?: FormEvent<HTMLFormElement>) => {
		e?.preventDefault();
		const q = encodeURIComponent(searchInputRef.current?.value || "");
		router.push(`/search/${q}`);
	};

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

	useEffect(() => {
		const onKeyUp = (e: KeyboardEvent) => {
			if (e.key === "Escape") setMenuOpen(false);
		};
		document.addEventListener("keyup", onKeyUp);
		return () => document.removeEventListener("keyup", onKeyUp);
	}, []);

	useEffect(() => {
		let cancelled = false;
		const getIssue = async () => {
			try {
				const cached = sessionStorage.getItem(PRINT_ISSUE_CACHE_KEY);
				if (cached) {
					const parsed = JSON.parse(cached) as { month?: number; year?: number; expiry?: number };
					if (parsed?.month && parsed?.year && parsed?.expiry && parsed.expiry > Date.now()) {
						if (!cancelled) setIssue({ month: parsed.month, year: parsed.year });
						return;
					}
				}
			} catch {
				/* noop */
			}

			let month = new Date().getMonth() + 1;
			let year = new Date().getFullYear();

			if (await pdfExists(month, year)) {
				if (!cancelled) {
					sessionStorage.setItem(PRINT_ISSUE_CACHE_KEY, JSON.stringify({ month, year, expiry: Date.now() + 6 * 60 * 60 * 1000 }));
					setIssue({ month, year });
				}
				return;
			}

			for (let i = 0; i < 12; i++) {
				month--;
				if (month === 0) {
					month = 12;
					year--;
				}
				if (!(await pdfExists(month, year))) continue;
				if (!cancelled) {
					sessionStorage.setItem(PRINT_ISSUE_CACHE_KEY, JSON.stringify({ month, year, expiry: Date.now() + 6 * 60 * 60 * 1000 }));
					setIssue({ month, year });
				}
				return;
			}
		};

		void getIssue();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		setMenuOpen(false);
	}, [router.asPath]);

	useEffect(() => {
		const timeout = window.setTimeout(() => {
			setMenuX(menuOpen);
		}, 100);

		return () => window.clearTimeout(timeout);
	}, [menuOpen]);

	// Clear global search box when navigating away from search
	useEffect(() => {
		const path = router.asPath || "";
		// Clear when not on the search page so the box doesn't persist
		if (!path.startsWith("/search")) {
			if (searchInputRef.current) searchInputRef.current.value = "";
		}
	}, [router.asPath]);

	return (
		<div className="header">
			<Link href="/home" id="masthead">
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img src="/assets/tower-short.png" alt="" draggable="false" />
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
						<p suppressHydrationWarning>{displayFullDate().toUpperCase()}</p>
					</div>
					<button id="menu" data-open={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
						<span className="menu-icon" aria-hidden="true">
							<svg className="menu-icon-hamburger" viewBox="0 0 24 24">
								<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
							</svg>
							<svg className="menu-icon-close" viewBox="0 0 24 24">
								<path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
							</svg>
						</span>
						<span>Sections</span>
					</button>
				</div>
				<div className="right-stuff">
					<button className="subscribe" onClick={() => router.push("/subscribe")}>
						<span>Subscribe</span>
					</button>
					<form className="search-box" role="search" autoComplete="off" onSubmit={submitSearch}>
						<input
							ref={searchInputRef}
							type="search"
							name="tower-search"
							placeholder="Search"
							aria-label="Search articles"
							autoComplete="off"
							autoCorrect="off"
							autoCapitalize="none"
							spellCheck={false}
							enterKeyHint="search"
							onFocus={() => warmSearchIndex()}
						/>
						<button type="submit" aria-label="Submit search" onMouseEnter={() => warmSearchIndex()}>
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" fill="none" />
								<path d="M16.2 16.2l4.3 4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
							</svg>
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}

export default function App({ Component, pageProps }: AppProps) {
	const router = useRouter();
	const [pageTransitionState, setPageTransitionState] = useState<"idle" | "leaving" | "entering">("idle");
	const transitionTimeoutRef = useRef<number | null>(null);
	const enablePageTransitions = true;

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (sessionStorage.getItem(SITE_VISIT_TRACKED_KEY)) return;
		sessionStorage.setItem(SITE_VISIT_TRACKED_KEY, "1");

		fetch("/api/track", { method: "POST" }).catch(() => {});
	}, []);

	useEffect(() => {
		if (!enablePageTransitions) return;
		const clearTransitionTimeout = () => {
			if (transitionTimeoutRef.current === null) return;
			window.clearTimeout(transitionTimeoutRef.current);
			transitionTimeoutRef.current = null;
		};

		const handleRouteStart = (url: string) => {
			if (url === router.asPath) return;
			clearTransitionTimeout();
			setPageTransitionState("leaving");
		};

		const handleRouteComplete = () => {
			clearTransitionTimeout();
			setPageTransitionState("entering");
			transitionTimeoutRef.current = window.setTimeout(() => {
				setPageTransitionState("idle");
				transitionTimeoutRef.current = null;
			}, 150);
		};

		const handleRouteError = () => {
			clearTransitionTimeout();
			setPageTransitionState("idle");
		};

		router.events.on("routeChangeStart", handleRouteStart);
		router.events.on("routeChangeComplete", handleRouteComplete);
		router.events.on("routeChangeError", handleRouteError);

		return () => {
			clearTransitionTimeout();
			router.events.off("routeChangeStart", handleRouteStart);
			router.events.off("routeChangeComplete", handleRouteComplete);
			router.events.off("routeChangeError", handleRouteError);
		};
	}, [enablePageTransitions, router]);

	return (
		<>
			<Head>
				<title>Home | The Tower</title>
				<meta name="viewport" content="width=device-width, initial-scale=1" />
			</Head>
			{/* <Banner /> */}
			<Nav />
			<PromoPopup />
			<main className="content" data-transition={enablePageTransitions ? pageTransitionState : "idle"}>
				<div className="page-shell">
					<Component {...pageProps} />
				</div>
			</main>
			<Footer />
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
				<Link href="https://forms.gle/zWq3kfLigfHt9JAQA" className="home-btn">
					Report problem Â»
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
					<Link href="/category/vanguard/articles">Articles</Link>
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
			<span suppressHydrationWarning>&copy; 2017-{new Date().getFullYear()} The Tower</span>
			<span>
				Site by Luke Tong &apos;23, Jieruei Chang &apos;24, Henry Langmack &apos;25, Ayush Shrivastava &apos;25, Anita Ndubisi &apos;26, Om
				Mehta &apos;26, Aryan Singla &apos;27, and Alexander Sheng &apos;28
			</span>
		</footer>
	);
}

export function reportWebVitals(metric: NextWebVitalsMetric) {
	console.log(metric);
}
