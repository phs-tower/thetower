/** @format */

import { article, spreads } from "@prisma/client";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import ArticlePreview from "~/components/preview.client";
import Video from "~/components/video.client";
import Podcast from "~/components/podcast.client";
import { getFrontpageArticles, getIdOfNewest, getSpreadsByCategory } from "~/lib/queries";
import SubBanner from "~/components/subbanner.client";
import { SectionContainer, VanguardContainer } from "~/components/sectioncontainer.client";

import sponsorStyles from "./sponsor.module.scss";

export async function getStaticProps() {
	const articles = await getFrontpageArticles();
	const vang = await getSpreadsByCategory("vanguard", 6, await getIdOfNewest("vanguard", null), 0);

	return {
		props: {
			articles,
			vang,
		},
		revalidate: 60, // Regenerate once every minute
	};
}

interface Props {
	articles: { [name: string]: article[] };
	vang: spreads[];
}

export default function FrontPage({ articles, vang }: Props) {
	return (
		<div>
			<Head>
				<meta property="og:title" content="Home | The Tower" />
				<meta property="og:description" content="The Tower is Princeton High School's newspaper club." />
			</Head>
			<div className="mosaic">
				<div className="triple">
					<div>
						{/* <h3 className="section-header">OPINIONS</h3> */}
						<hr />
						<ArticlePreview article={articles["opinions"][0]} style="box" size="large" />
						<ArticlePreview article={articles["opinions"][1]} style="box" size="large" />
						{/* <ArticlePreview article={articles["opinions"][2]} style="box" size="large" /> */}
					</div>
					<div>
						<ArticlePreview article={articles["featured"][0]} style="box" size="featured" />
					</div>
					<div>
						{/* <h3 className="section-header">SPORTS</h3> */}
						<hr />
						<ArticlePreview article={articles["sports"][0]} style="box" size="large" />
						<ArticlePreview article={articles["sports"][1]} style="box" size="large" />
						{/* <ArticlePreview article={articles["sports"][2]} style="box" size="large" /> */}
					</div>
				</div>
				<div className="one">
					<ArticlePreview article={articles["featured"][0]} style="box" size="featured" />

					<ArticlePreview article={articles["opinions"][0]} style="box" size="large" />
					<ArticlePreview article={articles["opinions"][1]} style="box" size="large" />
					<ArticlePreview article={articles["opinions"][2]} style="box" size="large" />

					<ArticlePreview article={articles["sports"][0]} style="box" size="large" />
					<ArticlePreview article={articles["sports"][1]} style="box" size="large" />
					<ArticlePreview article={articles["sports"][2]} style="box" size="large" />
				</div>
			</div>
			<br />
			<hr />
			<br />
			<SectionContainer category="NEWS & FEATURES" desc="The latest stories on PHS and its community." articles={articles["news-features"]} />
			<hr />
			<br />
			<SectionContainer
				category="OPINIONS"
				desc="Opinions of the student body, from school policies to global issues."
				articles={articles["opinions"]}
			/>
			{/* <div className="dark-banner">
				<div id="dark-banner-content">
					<hr />
					<div style={{ display: "flex", marginLeft: "5vw", marginRight: "5vw", gap: "1rem" }}>
						<Image src="/assets/white-tower.png" width={309} height={721} alt="Tower logo" style={{ width: "15rem", height: "auto" }} />
						<div>
							<h2 style={{ marginTop: "1.5rem", marginBottom: "1.5rem", textAlign: "left" }}>
								The Tower is Princeton High School&apos;s student-run newspaper.
							</h2>
							<p style={{ textAlign: "left", fontSize: "1.5rem" }}>
								Since 1928, the Tower has been reporting on the inner workings of PHS, the district, and the cultural and athletic
								events that affect the student body.
								<br /> <br />
								Each year, the staff produces eight issues to be distributed. Subscribe to have the latest stories delivered to your
								door.
							</p>
						</div>
					</div>
					<hr />
				</div>
			</div> */}
			{/* ^^ this is just... bland? like it pollutes the page and makes it rly uninteresting (maybe its filling in for the page being kinda boring? idk tho :shrug:) */}
			<br />
			<hr />
			<br />
			<SectionContainer category="ARTS & ENTERTAINMENT" desc="Music, theatre, and more." articles={articles["arts-entertainment"]} />
			<hr />
			<br />
			<SectionContainer category="SPORTS" desc="Updates on PHS games, tales of sports history, and more." articles={articles["sports"]} />
			<hr />
			<br />
			<div id="vang-container">
				<VanguardContainer desc="The most creative section, with the format changing each issue." spreads={vang} />
			</div>

			<SponsorBanner />
			<SubBanner title="Consider subscribing to The Tower." />
		</div>
	);
}

function SponsorBanner() {
	return (
		<div className={sponsorStyles.banner}>
			<h1 style={{ marginTop: "2.5rem" }}> Thank you to our sponsors for supporting us!</h1>
			<div className={sponsorStyles["sponsor-list"]}>
				<Link href="https://milkncookies.online/">
					<Image src="/assets/milk-cookies.png" width={2500} height={2500} alt="Milk & Cookies" />
				</Link>
				{/* Add other sponsors here once we get them */}
			</div>
			<i>
				Interested in sponsoring? Contact <Link href="mailto:phstowersenioreditors@gmail.com">phstowersenioreditors@gmail.com</Link> for more
				info
			</i>
		</div>
	);
}

export function Multimedia() {
	return (
		<div className="multimedia">
			<div>
				<section className="category">
					<em>
						<Link href={"/category/multimedia"}>
							<span style={{ margin: "0px", fontFamily: "Open Sans" }}>Multimedia</span>
						</Link>
					</em>
				</section>
				<Video link="GDDGmRkkS5A" title="Soccer Practice with Nick Matese" />
				<Podcast link="1187999" />
			</div>
		</div>
	);
}
