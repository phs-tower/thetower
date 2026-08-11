/** @format */

import Head from "next/head";
import styles from "./support.module.scss";

const SUPPORT_EMAIL = "phstowersenioreditors@gmail.com";

export default function Support() {
	return (
		<div className={styles.support}>
			<Head>
				<title>Support | The Tower</title>
				<meta property="og:title" content="Support | The Tower" />
				<meta property="og:description" content="Contact The Tower with questions or concerns about the PHS Tower app." />
			</Head>
			<h1>Support</h1>
			<p>
				Concerns? Contact us here:{" "}
				<a href={`mailto:${SUPPORT_EMAIL}`} className="underline-animation">
					{SUPPORT_EMAIL}
				</a>
			</p>
		</div>
	);
}
