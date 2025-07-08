/** @format */

import Head from "next/head";
import styles from "~/lib/styles";

export default function About() {
	return (
		<div className="about">
			<Head>
				<title>About | The Tower</title>
				<meta property="og:title" content="About | The Tower" />
				<meta property="og:description" content="About the Tower" />
			</Head>
			<style jsx>{`
				.about {
					max-width: 100vw;
					min-height: 100vh;
				}
				h1 {
					text-align: center;
					border-bottom: 3px solid gainsboro;
					margin-bottom: 4vh;
					/* font-weight: bold; */
				}

				h2 {
					text-align: center;
				}

				p {
					margin-left: 24vw;
				}
				p,
				b {
					max-width: 45vw;
					/* font-family: ${styles.font.serifText}, ${styles.font.stack}; */
				}
				b {
					/* font-size: large; */
				}
			`}</style>
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
				The Editoral Board of the Tower consists of a select group of 14 Tower 2023 staff members. The views of board members are accurately
				reflected in the editorial, which is co-written each month by the Board with primary authorship changing monthly.
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
