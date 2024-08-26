/** @format */

import { article, spreads } from "@prisma/client";
import Head from "next/head";
import Video from "~/components/video.client";
import Podcast from "~/components/podcast.client";
import { getIdOfNewest, getMultiItems } from "~/lib/queries";
import NoSSR from "~/components/nossr.client";
import styles from "~/lib/styles";
import { useEffect, useState } from "react";
import { multimedia } from "@prisma/client";

interface Props {
	videos: multimedia[];
	pods: multimedia[];
}

export async function getServerSideProps() {
	return {
		props: {
			videos: await getMultiItems("youtube", 5, await getIdOfNewest("multimedia", "youtube"), 0),
			pods: await getMultiItems("podcast", 5, await getIdOfNewest("multimedia", "podcast"), 0),
		},
	};
}

export default function Category(props: Props) {
	const [videos, setVideos] = useState(props.videos);
	const [vCursor, setVCursor] = useState(videos[videos.length - 1].id);

	const [pods, setPods] = useState(props.pods);
	const [pCursor, setPCursor] = useState(pods[pods.length - 1].id);

	async function newVideos() {
		let loading = document.getElementById("loading-videos");
		if (loading == null) return; // to make the compiler happy
		loading.setAttribute("style", "display: block");
		const response = await fetch("/api/loadsub", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ subcategory: "youtube", cursor: vCursor }),
		});

		const loaded = await response.json();
		if (loaded.length != 0) {
			setVideos([...videos, ...loaded]);
			setVCursor(loaded[loaded.length - 1].id);
			loading.setAttribute("style", "display: none");
		} else {
			loading.innerText = "No more videos to load.";
		}
	}

	async function newPods() {
		// TODO: get rid of this repetitive code, make load more button into a component
		let loading = document.getElementById("loading-pods");
		if (loading == null) return; // to make the compiler happy
		loading.setAttribute("style", "display: block");
		const response = await fetch("/api/loadsub", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ subcategory: "podcast", cursor: pCursor }),
		});

		const loaded = await response.json();
		if (loaded.length != 0) {
			setPods([...pods, ...loaded]);
			setPCursor(loaded[loaded.length - 1].id);
			loading.setAttribute("style", "display: none");
		} else {
			loading.innerText = "No more podcasts to load.";
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
					font-size: calc(1.5rem + 1vw);
				}

				h2 {
					/* font-family: ${styles.font.serifHeader}; */
				}

				.grid {
					display: grid;
					grid-template-columns: 2fr 1fr 1fr;
					/*height: 100vh;*/
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
				.sm-grid {
					display: grid;
					grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
					gap: 1vw;
				}
				.videos,
				.papercasts {
					height: 100%;
					/*overflow-y: scroll;*/
				}
				iframe {
					background-color: #f6f6f6;
				}

				#loadmore {
					border-radius: 2rem;
					font-family: ${styles.font.sans};
					font-size: calc(0.25rem + 1vw);
					color: black;
					background-color: white;
					border-style: solid;
					border-color: black;
					padding: 0.5rem;
					padding-left: 0.75rem;
					padding-right: 0.75rem;
					transition: 0.25s;
				}

				#loadmore:hover {
					color: white;
					background-color: black;
				}

				#loading {
					display: none;
				}
			`}</style>
			<h1>Multimedia</h1>
			<div className="grid">
				<NoSSR>
					<section className="videos">
						{videos.map(v => (
							<div key={v.id} className="video-wrapper">
								<Video key={v.id} link={v.src_id} title={v.title} />
								<br />
							</div>
						))}
						<h3 id="loading-videos" style={{ display: "none" }}>
							Loading videos, please wait...
						</h3>
						<button id="loadmore" onClick={newVideos}>
							Load more
						</button>
						{/* <Video link="X6yiU_yupyw" title="Diving into Testing Season at PHS" />
						<br />
						<Video link="OL0By_NUTP4" title="Asian Fest Hosted by PHS" />
						<br />
						<Video link="icIwD1E3_SI" title="PHS Jazz Ensemble's Trip to Hawaii" />
						<br />
						<Video link="GDDGmRkkS5A" title="Soccer Practice with Nick Matese" />
						<br />
						<Video link="NlVjqI7eSfc" title="To Track or Not To Track? - A Math Talk with NCTM President Kevin Dykema" />
						<br />
						<Video link="VEcVyFME3M0" title="The Making of Newsies" />
						<br />
						<Video link="Z4bZBXoVseo" title="Artist of the Month: Kevin Huang Profile" /> */}
						{/*
						<div className="sm-grid">
							<Video link="Z4bZBXoVseo" title="Artist of the Month: Kevin Huang Profile" />
						</div>*/}
					</section>

					{/*<section className="papercasts">
						<h2>Papercasts</h2>
					</section>*/}
					<section className="papercasts">
						<h2>PHS Talks</h2>
						<em>This podcast is no longer active.</em>
						<Podcast link="phstalks/1272351" />
						<Podcast link="phstalks/1233141" />
						<Podcast link="phstalks/1187999" />
						<Podcast link="phstalks/1187999" />
						<Podcast link="phstalks/1143064" />
					</section>
					<section className="rightbar">
						<h2>Tower Shorts</h2>
						{pods.map(p => (
							<Podcast key={p.id} link={p.src_id} />
						))}
						<h3 id="loading-pods" style={{ display: "none" }}>
							Loading podcasts, please wait...
						</h3>
						<button id="loadmore" onClick={newPods}>
							Load more
						</button>
						{/* <Podcast link="towershorts/1484378/" />
						<Podcast link="towershorts/1412519" />
						<Podcast link="towershorts/1342192" />
						<Podcast link="towershorts/1369461" /> */}
					</section>
				</NoSSR>
			</div>
		</div>
	);
}
