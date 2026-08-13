/** @format */

import Head from "next/head";
import Link from "next/link";
import styles from "./install.module.scss";

// Drop the app store / download URL in here when it's ready — the page swaps
// the "coming soon" placeholder for a real download button on its own.
const APP_LINK = "";

const SUPPORT_EMAIL = "phstowersenioreditors@gmail.com";

export default function Install() {
	return (
		<div className={styles.install}>
			<Head>
				<title>Get the App | The Tower</title>
				<meta property="og:title" content="Get the App | The Tower" />
				<meta property="og:description" content="The PHS Tower app is coming soon." />
			</Head>

			<div className={styles.card}>
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img className={styles.icon} src="/assets/tower-short.png" alt="" draggable="false" />

				<span className={styles.badge}>Coming Soon</span>

				<h1>The Tower App</h1>

				<p className={styles.tagline}>Princeton High School&apos;s student newspaper, in your pocket.</p>

				<p className={styles.body}>
					We&apos;re putting the finishing touches on an app that brings every story, print issue, and crossword to your phone. Check back
					here soon — the download link will live on this page.
				</p>

				{APP_LINK ? (
					<Link href={APP_LINK} className={styles.button}>
						Download the App
					</Link>
				) : (
					<span className={`${styles.button} ${styles.disabled}`} aria-disabled="true">
						Download the App
					</span>
				)}

				<div className={styles.divider} />

				<p className={styles.footnote}>
					In the meantime, read us at{" "}
					<Link href="/home" className="underline-animation">
						towerphs.com
					</Link>
					.
				</p>
				<p className={styles.footnote}>
					Questions?{" "}
					<a href={`mailto:${SUPPORT_EMAIL}`} className="underline-animation">
						{SUPPORT_EMAIL}
					</a>
				</p>
			</div>
		</div>
	);
}
