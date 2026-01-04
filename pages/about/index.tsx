/** @format */

import Head from "next/head";
import fs from "fs";
import path from "path";
// import styles from "~/lib/styles";
import styles from "./about.module.scss";

interface AboutProps {
	latestYear: number;
	memberCount: number;
}

export async function getStaticProps() {
	const contentDir = path.join(process.cwd(), "content");
	const files = fs.readdirSync(contentDir);
	const years = files
		.map(f => /^(\d{4})\.json$/i.exec(f)?.[1])
		.filter(Boolean)
		.map(y => parseInt(y as string, 10));

	const latestYear = years.length ? Math.max(...years) : new Date().getFullYear();
	let memberCount = 0;
	try {
		const raw = fs.readFileSync(path.join(contentDir, `${latestYear}.json`), "utf8");
		const data = JSON.parse(raw) as { sections?: { name: string; members?: unknown[] }[] };
		memberCount = (data.sections || [])
			.filter(s => s && typeof s.name === "string" && s.name.toLowerCase() !== "advisors")
			.reduce((sum, s) => sum + (Array.isArray(s.members) ? s.members.length : 0), 0);
	} catch {}

	return { props: { latestYear, memberCount } };
}

export default function About({ latestYear, memberCount }: AboutProps) {
	return (
		<div className={styles.about}>
			<Head>
				<title>About | The Tower</title>
				<meta property="og:title" content="About | The Tower" />
				<meta property="og:description" content="About the Tower" />
			</Head>
			{/* ^^^ Again, this is hella ugly... and we shouldn't need declarations in this many places if we were just consistent lol */}
			<h1>About</h1>
			<h2>Mission Statement</h2>
			<p>
				The Tower serves as a medium of information for the community through reporting and/or analyzing the inner workings of Princeton High
				School, the school district, and cultural and athletic events that affect the student body; providing a source of general news for
				parents, teachers, and peers; voicing various opinions from an informed group of writers; and maintaining quality in accurate content
				and appealing aesthetics, as well as upholding professionalism and journalistic integrity.
			</p>
			<br />
			<br />

			<h2>Editorial Board</h2>
			<p>
				{/* noone has edited this since 2023... */}
				The Editoral Board of the Tower consists of a select group of {memberCount} Tower {latestYear} staff members. The views of board
				members are accurately reflected in the editorial, which is co-written each month by the Board with primary authorship changing
				monthly.
			</p>
			<br />
			<br />

			<h2>Letter and Submission Policy</h2>
			<p>
				{/* make a custom email its so easy (and so free like what) like actually pls */}
				All letters and articles are welcome for consideration. Please email all submissions to{" "}
				<a href="mailto:phstowersenioreditors@gmail.com">phstowersenioreditors@gmail.com</a>. The editors reserve the rights to alter letters
				for length and to edit articles. The Editors-in-Chief take full responsibility for the content of this paper.
			</p>
			<br />
			<br />

			<h2>Publication Policy</h2>
			<p>
				The newspaper accepts advice from the administration and the advisors in regard to the newspaper’s content; however, the final
				decision to print the content lies with the Editors-in-Chief. The Tower’s articles do not necessarily represent the views of the
				administration, faculty, or staff.
			</p>
			<br />
			<br />

			<h2>Corrections</h2>
			<p>
				The Tower aims to uphold accuracy in articles and welcomes suggestions regarding the content of the articles. Corrections and
				retractions of articles will be determined on a case-by-case basis; please email all requests to{" "}
				<a href="mailto:phstowersenioreditors@gmail.com">phstowersenioreditors@gmail.com</a> for consideration.
			</p>
			{/* ok fine generally but this text is so dry like i cant imagine anyone willingly reading through this */}
		</div>
	);
}
