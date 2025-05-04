/** @format */

import React, { useState } from "react";
import type { GetStaticProps } from "next";
import dynamic from "next/dynamic";
import Head from "next/head";
import NoSSR from "~/components/nossr.client";
import { getIdOfNewest, getMultiItems } from "~/lib/queries";
import styles from "~/lib/styles";
import { multimedia } from "@prisma/client";

import { socialLinks } from "~/lib/constants";

// Dynamically load heavy components only on client
const Video = dynamic(() => import("~/components/video.client"), { ssr: false });
const Podcast = dynamic(() => import("~/components/podcast.client"), { ssr: false });

interface Props {
	videos: multimedia[];
	pods: multimedia[];
}

export const getStaticProps: GetStaticProps<Props> = async () => {
	const [videos, pods] = await Promise.all([
		getMultiItems("youtube", 5, await getIdOfNewest("multimedia", "youtube"), 0),
		getMultiItems("podcast", 5, await getIdOfNewest("multimedia", "podcast"), 0),
	]);

	return {
		props: { videos, pods },
		revalidate: 60,
	};
};

export default function Multimedia({ videos: initialVideos, pods: initialPods }: Props) {
	// Videos state
	const [videos, setVideos] = useState(initialVideos);
	const [vCursor, setVCursor] = useState<number | null>(initialVideos[initialVideos.length - 1]?.id ?? null);
	const [loadingV, setLoadingV] = useState({ display: "none", text: "Loading videos, please wait..." });

	// Podcasts state
	const [pods, setPods] = useState(initialPods);
	const [pCursor, setPCursor] = useState<number | null>(initialPods[initialPods.length - 1]?.id ?? null);
	const [loadingP, setLoadingP] = useState({ display: "none", text: "Loading podcasts, please wait..." });

	// Load more videos
	async function loadMoreVideos() {
		setLoadingV({ display: "block", text: "Loading videos, please wait..." });
		const res = await fetch("/api/load/loadsub", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ subcategory: "youtube", cursor: vCursor }),
		});
		const more: multimedia[] = await res.json();
		if (more.length) {
			setVideos(prev => [...prev, ...more]);
			setVCursor(more[more.length - 1].id);
			setLoadingV({ ...loadingV, display: "none" });
		} else {
			setLoadingV({ display: "block", text: "No more videos to load." });
		}
	}

	// Load more podcasts
	async function loadMorePods() {
		setLoadingP({ display: "block", text: "Loading podcasts, please wait..." });
		const res = await fetch("/api/load/loadsub", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ subcategory: "podcast", cursor: pCursor }),
		});
		const more: multimedia[] = await res.json();
		if (more.length) {
			setPods(prev => [...prev, ...more]);
			setPCursor(more[more.length - 1].id);
			setLoadingP({ ...loadingP, display: "none" });
		} else {
			setLoadingP({ display: "block", text: "No more podcasts to load." });
		}
	}

	return (
		<div className="multimedia">
			<Head>
				<title>Multimedia | The Tower</title>
				<meta property="og:title" content="Multimedia | The Tower" />
				<meta property="og:description" content="Multimedia at the Tower" />
			</Head>

			<style jsx>{`
				h1 {
					text-align: center;
					border-bottom: 3px double black;
					margin-bottom: 1vh;
					font-weight: bold;
				}
				.grid {
					display: grid;
					grid-template-columns: 2fr 1fr 1fr;
				}
				@media (max-width: 1000px) {
					.grid {
						grid-template-columns: 1fr;
					}
				}
				.grid > section:nth-child(even) {
					border-left: 1px solid gainsboro;
					border-right: 1px solid gainsboro;
				}
				section {
					padding: 1vw;
					box-sizing: border-box;
				}
				.loadmore {
					border-radius: 2rem;
					font-family: ${styles.font.sans};
					font-size: 1.6rem;
					color: black;
					background-color: white;
					border: 1px solid ${styles.color.darkAccent};
					padding: 0.5rem 0.75rem;
					transition: 0.25s;
					cursor: pointer;
				}
				.loadmore:hover {
					color: white;
					background-color: ${styles.color.darkAccent};
				}

				.topbar {
					display: flex;
					justify-content: space-between;
					align-items: center;
				}

				.social-icons {
					display: flex;
					align-items: center;
					gap: 0.5rem;
					margin-top: 0;
					margin-bottom: 0;
					color: #444;
				}

				.social-icons .follow-text {
					font-size: 1.35rem;
					font-family: ${styles.font.sans};
					margin-right: 0.5rem;
					color: #444;
				}

				.social-icons a {
					color: inherit;
					transition: transform 0.2s ease, color 0.2s ease;
				}

				.social-icons a:hover {
					transform: scale(1.1);
					color: ${styles.color.darkAccent};
				}
			`}</style>

			<h1>Multimedia</h1>

			<div className="grid">
				<NoSSR>
					<section className="videos">
						{/* social bar at top */}
						<div className="topbar">
							<div className="social-icons">
								<span className="follow-text">Follow us:</span>
								{socialLinks.map(({ name, url, icon }) => {
									// tell TS this is a component that takes a `size` prop
									const IconComponent = icon as React.ComponentType<{ size?: string }>;
									return (
										<a key={name} href={url} target="_blank" rel="noopener noreferrer" aria-label={name}>
											<IconComponent size="1.7em" />
										</a>
									);
								})}
							</div>
						</div>

						{videos.map(v => (
							<div key={v.id} className="video-wrapper">
								<Video link={v.src_id} title={v.title} />
								<br />
							</div>
						))}
						<p style={{ display: loadingV.display }}>{loadingV.text}</p>
						<button className="loadmore" onClick={loadMoreVideos}>
							Load more
						</button>
					</section>

					<section className="papercasts">
						<h2>PHS Talks</h2>
						<em>This podcast is no longer active.</em>
						<Podcast link="phstalks/1272351" />
						<Podcast link="phstalks/1233141" />
						<Podcast link="phstalks/1187999" />
						<Podcast link="phstalks/1143064" />
					</section>

					<section className="rightbar">
						<h2>Tower Shorts</h2>
						{pods.map(p => (
							<Podcast key={p.id} link={p.src_id} />
						))}
						<p style={{ display: loadingP.display }}>{loadingP.text}</p>
						<button className="loadmore" onClick={loadMorePods}>
							Load more
						</button>
					</section>
				</NoSSR>
			</div>
		</div>
	);
}
