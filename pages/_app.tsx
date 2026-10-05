/** @format */

import type { AppProps, NextWebVitalsMetric } from "next/app";
import Head from "next/head";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import "~/styles/styles.scss";
import "~/styles/admin.scss";
import styles from "~/lib/styles";
import { useRouter } from "next/router";
import { socialLinks } from "~/lib/constants";
import { APP_STORE_URL } from "~/lib/app-links";
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

// The header and footer share section names and destinations.
const siteSections: { name: string; href: string; subsections?: Subsection[]; inFooter?: boolean }[] = [
	{
		name: "NEWS & FEATURES",
		href: "/category/news-features",
		inFooter: true,
		subsections: [{ name: "PHS Profiles", href: "/category/news-features/phs-profiles" }],
	},
	{ name: "MULTIMEDIA", href: "/category/multimedia" },
	{
		name: "OPINIONS",
		href: "/category/opinions",
		inFooter: true,
		subsections: [
			{ name: "Editorials", href: "/category/opinions/editorials" },
			{ name: "Cheers & Jeers", href: "/category/opinions/cheers-jeers" },
		],
	},
	{ name: "VANGUARD", href: "/category/vanguard", inFooter: true, subsections: [{ name: "Articles", href: "/category/vanguard/articles" }] },
	{
		name: "ARTS & ENTERTAINMENT",
		href: "/category/arts-entertainment",
		inFooter: true,
		subsections: [{ name: "Student Artists", href: "/category/arts-entertainment/student-artists" }],
	},
	{
		name: "SPORTS",
		href: "/category/sports",
		inFooter: true,
		subsections: [{ name: "Student Athletes", href: "/category/sports/student-athletes" }],
	},
	{ name: "CROSSWORDS", href: "/games/crossword" },
	{ name: "ABOUT", href: "/about" },
	{ name: "ARCHIVES", href: "/archives" },
];

function SectionLink({ href, name: section, subsections }: { href: string; name: string; subsections?: Subsection[] }) {
	const [open, setOpen] = useState(false);
	return (
		<div className="section-link" data-open={open ? "true" : "false"}>
			<div className="section-button">
				<Link href={href}>{section}</Link>
				{subsections && <div className="bar-vertical" />}
				{subsections && (
					<button
						type="button"
						className="section-toggle"
						aria-label={`Toggle ${section} submenu`}
						aria-expanded={open}
						onClick={e => {
							e.preventDefault();
							setOpen(!open);
						}}
					>
						<i className="fa-solid fa-chevron-down" data-open={open} />
					</button>
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
		void (async () => {
			try {
				const cached = sessionStorage.getItem(STAFF_YEARS_CACHE_KEY);
				if (cached) {
					const years = JSON.parse(cached) as number[];
					if (!cancelled && Array.isArray(years) && years.length > 0) {
						setAboutSubsections(years.map(year => ({ name: `${year} Staff`, href: `/about/${year}` })));
						return;
					}
				}

				const response = await fetch("/api/staff-years");
				if (!response.ok) return;
				const payload = (await response.json()) as { years?: number[] };
				if (!cancelled && Array.isArray(payload.years)) {
					sessionStorage.setItem(STAFF_YEARS_CACHE_KEY, JSON.stringify(payload.years));
					setAboutSubsections(payload.years.map(year => ({ name: `${year} Staff`, href: `/about/${year}` })));
				}
			} catch {
				/* noop */
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<nav>
			<Masthead />
			<div id="links">
				{siteSections.map(section => (
					<SectionLink
						key={section.href}
						href={section.href}
						name={section.name}
						subsections={section.href === "/about" ? aboutSubsections : section.subsections}
					/>
				))}
			</div>
		</nav>
	);
}

function Masthead() {
	const [issue, setIssue] = useState({ month: 2, year: 2022 });
	const [menuOpen, setMenuOpen] = useState(false);
	const router = useRouter();
	const searchInputRef = useRef<HTMLInputElement>(null);

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
		void (async () => {
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

			// Check this month and the previous twelve months, newest first.
			for (let monthsBack = 0; monthsBack <= 12; monthsBack++) {
				let issueExists = false;
				try {
					const response = await fetch(`https://yusjougmsdnhcsksadaw.supabase.co/storage/v1/object/public/prints/${month}-${year}.pdf`, {
						method: "HEAD",
					});
					issueExists = response.ok;
				} catch {
					// An unavailable PDF should not prevent checking earlier issues.
				}
				if (issueExists) {
					if (!cancelled) {
						sessionStorage.setItem(PRINT_ISSUE_CACHE_KEY, JSON.stringify({ month, year, expiry: Date.now() + 6 * 60 * 60 * 1000 }));
						setIssue({ month, year });
					}
					return;
				}
				month--;
				if (month === 0) {
					month = 12;
					year--;
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		setMenuOpen(false);
	}, [router.asPath]);

	// Clear global search box when navigating away from search
	useEffect(() => {
		if (!router.asPath.startsWith("/search") && searchInputRef.current) {
			searchInputRef.current.value = "";
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
					<form
						className="search-box"
						role="search"
						autoComplete="off"
						onSubmit={event => {
							event.preventDefault();
							const searchQuery = encodeURIComponent(searchInputRef.current?.value || "");
							router.push(`/search/${searchQuery}`);
						}}
					>
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
	const [routePending, setRoutePending] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (sessionStorage.getItem(SITE_VISIT_TRACKED_KEY)) return;
		sessionStorage.setItem(SITE_VISIT_TRACKED_KEY, "1");

		fetch("/api/track", { method: "POST" }).catch(() => {});
	}, []);

	useEffect(() => {
		const handleRouteStart = (url: string) => {
			if (url === router.asPath) return;
			setRoutePending(true);
		};

		const handleRouteDone = () => {
			setRoutePending(false);
		};

		router.events.on("routeChangeStart", handleRouteStart);
		router.events.on("routeChangeComplete", handleRouteDone);
		router.events.on("routeChangeError", handleRouteDone);

		return () => {
			router.events.off("routeChangeStart", handleRouteStart);
			router.events.off("routeChangeComplete", handleRouteDone);
			router.events.off("routeChangeError", handleRouteDone);
		};
	}, [router]);

	// The Tower Console lives under /admin with its own chrome — no site nav,
	// footer, or promo popup.
	if (router.pathname === "/admin" || router.pathname.startsWith("/admin/")) {
		return (
			<>
				<Head>
					<meta name="viewport" content="width=device-width, initial-scale=1" />
				</Head>
				<Component {...pageProps} />
			</>
		);
	}

	return (
		<>
			<Head>
				<title>Home | The Tower</title>
				<meta name="viewport" content="width=device-width, initial-scale=1" />
			</Head>
			<Nav />
			<PromoPopup />
			<main className="content" data-route-pending={routePending ? "true" : "false"}>
				<div className="page-shell" key={router.asPath}>
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
				{siteSections
					.filter(section => section.inFooter)
					.map((section, sectionIndex, footerSections) => (
						<div key={section.href}>
							<b>
								<Link style={{ fontFamily: styles.font.serifHeader }} href={section.href}>
									{section.name}
								</Link>
								<br />
							</b>
							{section.subsections?.map((subsection, subsectionIndex) => (
								<Fragment key={subsection.href}>
									<Link href={subsection.href}>{subsection.name}</Link>
									{(subsectionIndex < section.subsections!.length - 1 || sectionIndex < footerSections.length - 1) && <br />}
								</Fragment>
							))}
						</div>
					))}
			</div>
			<ul className="footer-utility-links" aria-label="Privacy and app links">
				<li>
					<Link href="/privacy">Privacy Terms</Link>
				</li>
				<li>
					<a href={APP_STORE_URL}>Download our app</a>
				</li>
			</ul>
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
