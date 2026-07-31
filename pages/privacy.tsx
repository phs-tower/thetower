/** @format */

import Head from "next/head";
import fs from "fs";
import path from "path";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import styles from "./privacy.module.scss";

interface PrivacyProps {
	contentHtml: string;
}

export async function getStaticProps() {
	const markdown = fs.readFileSync(path.join(process.cwd(), "content", "privacy.md"), "utf8");
	const processed = await remark().use(remarkGfm).use(remarkHtml).process(markdown);
	return { props: { contentHtml: processed.toString() } };
}

export default function Privacy({ contentHtml }: PrivacyProps) {
	return (
		<div className={styles.privacy}>
			<Head>
				<title>Privacy Policy | The Tower</title>
				<meta property="og:title" content="Privacy Policy | The Tower" />
				<meta property="og:description" content="Privacy policy for the PHS Tower mobile app" />
			</Head>
			<div dangerouslySetInnerHTML={{ __html: contentHtml }} />
		</div>
	);
}
