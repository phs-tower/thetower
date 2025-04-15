/** @format */

import type { AppProps, NextWebVitalsMetric } from "next/app";
import Head from "next/head";
import Link from "next/link";
import dayjs from "dayjs";
import { useEffect, useState } from "react"; // <-- ADDED for useEffect, useState
import { FaFacebookSquare } from "@react-icons/all-files/fa/FaFacebookSquare";
import { FaInstagramSquare } from "@react-icons/all-files/fa/FaInstagramSquare";
import { FaYoutubeSquare } from "@react-icons/all-files/fa/FaYoutubeSquare";
import { FaSpotify } from "@react-icons/all-files/fa/FaSpotify";
import { SiApplepodcasts } from "@react-icons/all-files/si/SiApplepodcasts";
import Button from "~/components/button.client";
import "~/styles/styles.scss";
import styles from "~/lib/styles";

export default function App({ Component, pageProps }: AppProps) {
	return (
		<div>
			<Head>
				<title>Home | The Tower</title>
				<link rel="icon" href="/favicon.ico" sizes="32x32" />
			</Head>
			<Banner />
			<NavBar />
			<main className="content">
				<style jsx>{`
					main {
						display: block;
						margin-top: 4vh;
						margin-left: 2.5vw;
						margin-right: 2.5vw;
					}
				`}</style>
				<Component {...pageProps} />
			</main>
			<Footer />
		</div>
	);
}

// ======================
// REPLACED BANNER BELOW
// ======================
function Banner() {
	// We’ll check the current month first
	const currentMonth = dayjs().month() + 1; // 1-based
	const currentYear = dayjs().year();

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
			<style jsx>{`
				.banner {
					margin: 0px;
					padding-top: 0px;
					position: relative;
					background-color: ${styles.color.background};
				}
				.image {
					display: block;
					margin-left: auto;
					text-align: center;
					margin: 0px;
					padding: 0;
				}
				.image:hover {
					cursor: pointer;
				}
				.sub {
					position: absolute;
					left: 1vw;
					top: 5px;
					bottom: 5px;
				}
				.search {
					position: absolute;
					right: 1vw;
					bottom: 20px;
				}
				.search input {
					width: 200px;
					height: 30px;
					border: 1px solid ${styles.color.accent};
					border-radius: 5px 0px 0px 5px;
					padding: 5px;
					font-family: ${styles.font.sans};
					font-size: 1.6rem;
					box-sizing: border-box;
					vertical-align: middle;
					color: ${styles.color.accent};
				}
				.search input::placeholder {
					color: ${styles.color.lightAccent};
				}
				.search button {
					width: 30px;
					height: 32px;
					border: 1px solid ${styles.color.accent};
					border-radius: 5px 0px 0px 5px;
					transform: scaleX(-1);
					background-color: ${styles.color.accent};
					color: #fff;
					cursor: pointer;
					box-sizing: border-box;
					padding: 5px;
					vertical-align: middle;
				}
				@media screen and (max-width: 1000px) {
					.sub,
					.search {
						display: none;
					}
				}
			`}</style>

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
					{dayjs().format("dddd, MMMM D, YYYY ").toUpperCase()}
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
				<Link href="/home" passHref>
					<h1 style={{ fontFamily: "Canterbury", fontWeight: "normal", textAlign: "center", color: styles.color.accent, fontSize: "6rem" }}>
						The Tower
					</h1>
					<p
						style={{
							fontFamily: styles.font.sans,
							fontSize: "1.4rem",
							textAlign: "center",
							color: styles.color.accent,
							marginTop: "-15px",
						}}
					>
						Est. 1928
					</p>
				</Link>
			</div>
		</div>
	);
}

// ======================
// FOOTER & NAVBAR BELOW
// ======================
function Footer() {
	return (
		<div className="footer">
			<style jsx>{`
				.footer {
					display: grid;
					padding-top: 2vh;
					width: 90vw;
					margin-left: 5vw;
				}
				hr {
					align-self: center;
					background-color: #ccc;
					border: none;
					margin-top: 3vh;
					margin-bottom: 1vh;
					height: 3px;
				}
				.top h1 {
					font-family: Canterbury;
					font-size: xxx-large;
					float: left;
					padding-right: 10px;
					font-weight: normal;
				}
				.top a {
					display: inline-block;
					position: relative;
					padding-top: 2.5vh;
				}
				.top .home-btn {
					color: #274370;
					float: right;
					margin-right: 2.5vh;
				}
				.bottom {
					margin: 1vh;
					display: grid;
					grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
				}
				@media screen and (max-width: 700px) {
					.bottom {
						grid-template-columns: 1fr;
					}
				}
				span {
					padding-bottom: 2vh;
				}
			`}</style>
			<hr />
			<div className="top">
				<h1>The Tower</h1>
				<a href="https://www.instagram.com/thetowerphs/" target="_blank" rel="noopener noreferrer">
					<FaInstagramSquare size="2.2em" />
				</a>
				<a href="https://www.facebook.com/phstower" target="_blank" rel="noopener noreferrer">
					<FaFacebookSquare size="2.2em" />
				</a>
				<a href="https://www.youtube.com/channel/UCoopcAJbsz-qlTS2xkVWplQ" target="_blank" rel="noopener noreferrer">
					<FaYoutubeSquare size="3.5rem" />
				</a>
				<a href="https://open.spotify.com/show/2c0TlU1f01LKoVPaMMDxB8?si=f1fa622c0339438e" target="_blank" rel="noopener noreferrer">
					<FaSpotify size="3.5rem" />
				</a>
				<a href="https://podcasts.apple.com/us/podcast/phs-talks/id1674696258" target="_blank" rel="noopener noreferrer">
					<SiApplepodcasts size="3.5rem" />
				</a>
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
		</div>
	);
}

function NavBar() {
	const [menuOpen, setMenuOpen] = useState(false);
	const [search, setSearch] = useState("");

	useEffect(() => {
		const handleScroll = () => {
			if (menuOpen) setMenuOpen(false);
		};
		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, [menuOpen]);

	useEffect(() => {
		let lastScrollY = window.scrollY;
		const panel = document.getElementById("navbar-scroll-panel");

		const onScroll = () => {
			if (!panel) return;
			const scrollY = window.scrollY;
			const scrollingDown = scrollY > lastScrollY;

			if (scrollingDown && scrollY > 200) {
				panel.classList.add("visible");
			} else if (!scrollingDown && scrollY < 150) {
				panel.classList.remove("visible");
			}

			lastScrollY = scrollY;
		};

		window.addEventListener("scroll", onScroll);
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const closeMenu = () => setMenuOpen(false);
	const handleSearch = () => {
		if (search.trim()) {
			window.location.href = `/search/${encodeURIComponent(search.trim())}`;
			closeMenu();
		}
	};

	const subItems = {
		NEWS: [{ label: "Profiles", href: "/category/news-features/phs-profiles" }],
		OPINIONS: [
			{ label: "Editorials", href: "/category/opinions/editorials" },
			{ label: "Cheers & Jeers", href: "/category/opinions/cheers-jeers" },
		],
		VANGUARD: [
			{ label: "Spreads", href: "/category/vanguard" },
			{ label: "Articles", href: "/category/vanguard/vanguard" },
		],
		ARTS: [{ label: "Student Artists", href: "/category/arts-entertainment/student-artists" }],
		SPORTS: [{ label: "Student Athletes", href: "/category/sports/student-athletes" }],
		ABOUT: [
			{ label: "2025 Staff", href: "/about/2025" },
			{ label: "2024 Staff", href: "/about/2024" },
			{ label: "2023 Staff", href: "/about/2023" },
			{ label: "2022 Staff", href: "/about/2022" },
		],
	};

	return (
		<div className="navbar">
			<style jsx>{`
				.navbar {
					width: 100%;
					background-color: #0c1f3f;
					border-bottom: 1px solid #aaa;
				}
				.navbar-scroll-replace {
					position: fixed;
					top: -60px;
					left: 0;
					right: 0;
					height: 50px;
					background-color: #0c1f3f;
					color: white;
					display: flex;
					align-items: center;
					justify-content: center;
					padding: 0 1rem;
					z-index: 1500;
					transition: top 0.3s ease;
					font-family: Canterbury;
					font-size: 1.5rem;
				}
				.navbar-scroll-replace.visible {
					top: 0px;
				}
				.navbar-scroll-replace .left {
					position: absolute;
					left: 2rem;
					top: 30%;
					transform: translateY(-25%);
				}
				.navbar-scroll-replace .menu-button {
					font-size: 1.5rem;
					color: white;
					cursor: pointer;
					padding: 6px 10px;
					border: 1px solid white;
					background: none;
					border-radius: 4px;
				}
				.navbar-scroll-replace .menu-button:hover {
					background-color: white;
					color: #0c1f3f;
				}
				.navbar-scroll-replace .center-logo {
					display: block;
					position: absolute;
					left: 50%;
					transform: translateX(-50%);
					color: white;
					font-family: Canterbury;
					font-size: 2.5rem;
				}
				.strip {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding: 0.5rem 2vw;
					background-color: #0c1f3f;
					position: sticky;
					top: 0;
					z-index: 1100;
					margin-top: 1.5vh;
				}
				.left {
					display: flex;
					align-items: center;
				}
				.menu-button {
					font-size: 1.5rem;
					color: white;
					cursor: pointer;
					padding: 6px 10px;
					border: 1px solid white;
					background: none;
					border-radius: 4px;
				}
				.menu-button:hover {
					background-color: white;
					color: #0c1f3f;
				}
				.center-logo {
					display: none;
				}
				.right {
					display: flex;
					margin-left: 15rem;
					flex-grow: 1;
				}
				.menu {
					display: flex;
					flex-wrap: wrap;
					gap: 0.5rem;
				}
				.slideout {
					position: absolute;
					top: 15rem;
					left: 0;
					width: 150px;
					height: calc(100vh - 4.5rem);
					background-color: white;
					transform: translateX(${menuOpen ? "0" : "-100%"});
					transition: transform 0.3s ease-in-out;
					z-index: 999;
					box-shadow: 2px 0 6px rgba(0, 0, 0, 0.2);
					display: flex;
					flex-direction: column;
				}
				.top-bar {
					background-color: #f3f3f3;
					padding: ${menuOpen ? "10px" : "0"};
					border-bottom: ${menuOpen ? "1px solid #ccc" : "none"};
					display: ${menuOpen ? "flex" : "none"};
					gap: 0.5rem;
					align-items: center;
				}
				.top-bar input {
					width: 120px;
					padding: 4px 6px;
					font-size: 1.5rem;
					border: 1px solid #ccc;
					border-radius: 4px;
				}
				.top-bar button {
					padding: 4px 8px;
					font-size: 1rem;
					cursor: pointer;
					background-color: #0c1f3f;
					color: white;
					border: none;
					border-radius: 4px;
					margin-left: -2px;
				}
				.slideout ul {
					list-style: none;
					padding: 1rem;
					margin: 0;
					flex-grow: 1;
				}
				.slideout li {
					margin-bottom: 1rem;
					font-size: 1rem;
					color: black;
					cursor: pointer;
					transition: color 0.2s ease;
					position: relative;
					font-family: ${styles.font.serifHeader};
				}
				.slideout li a {
					color: black;
					text-decoration: none;
					transition: color 0.2s ease;
				}
				.slideout li a:hover {
					color: #003366;
					font-weight: 600;
				}
				.submenu {
					margin-top: 0.5rem;
					margin-left: 0.75rem;
					font-size: 0.85rem;
					color: #555;
					display: none;
					flex-direction: column;
					gap: 0.4rem;
				}
				.slideout li:hover .submenu {
					display: flex;
				}
				@media screen and (max-width: 1000px) {
					.menu {
						display: none;
					}
					.center-logo {
						display: block;
						position: absolute;
						left: 50%;
						transform: translateX(-50%);
						color: white;
						font-family: Canterbury;
						font-size: 2rem;
					}
				}
			`}</style>

			<div id="navbar-scroll-panel" className="navbar-scroll-replace">
				<div className="left">
					<button className="menu-button" onClick={() => setMenuOpen(!menuOpen)}>
						{menuOpen ? "×" : "☰"}
					</button>
				</div>
				<div className="center-logo">The Tower</div>
			</div>

			<div className="strip">
				<div className="left">
					<button className="menu-button" onClick={() => setMenuOpen(!menuOpen)}>
						{menuOpen ? "×" : "☰"}
					</button>
				</div>
				<div className="center-logo">The Tower</div>
				<div className="right">
					<div className="menu">
						<Button name="NEWS & FEATURES" href="/category/news-features">
							<Link href="/category/news-features/phs-profiles" legacyBehavior>
								<a>PHS Profiles</a>
							</Link>
						</Button>
						<Button name="MULTIMEDIA" href="/category/multimedia" />
						<Button name="OPINIONS" href="/category/opinions">
							<Link href="/category/opinions/editorials" legacyBehavior>
								<a>Editorials</a>
							</Link>
							<hr />
							<Link href="/category/opinions/cheers-jeers" legacyBehavior>
								<a>Cheers & Jeers</a>
							</Link>
						</Button>
						<Button name="VANGUARD" href="/category/vanguard">
							<Link href="/category/vanguard" legacyBehavior>
								<a>Spreads</a>
							</Link>
							<hr />
							<Link href="/category/vanguard/vanguard" legacyBehavior>
								<a>Articles</a>
							</Link>
						</Button>
						<Button name="ARTS & ENTERTAINMENT" href="/category/arts-entertainment">
							<Link href="/category/arts-entertainment/student-artists" legacyBehavior>
								<a>Student Artists</a>
							</Link>
						</Button>
						<Button name="SPORTS" href="/category/sports">
							<Link href="/category/sports/student-athletes" legacyBehavior>
								<a>Student Athletes</a>
							</Link>
						</Button>
						<Button name="CROSSWORD" href="/games/crossword" />
						<Button name="ABOUT" href="/about">
							{["2025", "2024", "2023", "2022"].map(yr => (
								<>
									<Link href={`/about/${yr}`} legacyBehavior>
										<a>{yr} Staff</a>
									</Link>
									<hr />
								</>
							))}
						</Button>
						<Button name="ARCHIVES" href="/archives" />
					</div>
				</div>
			</div>

			<div className="slideout">
				<div className="top-bar">
					<input
						type="text"
						value={search}
						onChange={e => setSearch(e.target.value)}
						onKeyDown={e => e.key === "Enter" && handleSearch()}
						placeholder="Search..."
					/>
					<button onClick={handleSearch}>Go</button>
				</div>
				<ul>
					{Object.keys(subItems).map((item, i) => (
						<li key={i}>
							<Link href={`/${item.toLowerCase()}`} legacyBehavior>
								<a onClick={closeMenu}>{item}</a>
							</Link>
							{subItems[item as keyof typeof subItems] && (
								<div className="submenu">
									{subItems[item as keyof typeof subItems].map((sub, j) => (
										<Link key={j} href={sub.href} legacyBehavior>
											<a onClick={closeMenu}>{`→ ${sub.label}`}</a>
										</Link>
									))}
								</div>
							)}
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}

export function reportWebVitals(metric: NextWebVitalsMetric) {
	console.log(metric);
}
