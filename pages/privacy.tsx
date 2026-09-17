/** @format */

import Head from "next/head";
import fs from "fs";
import path from "path";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import styles from "./privacy.module.scss";

interface PrivacyProps {
	titleHtml: string;
	contentHtml: string;
	sections: { id: string; html: string; level: number }[];
}

export async function getStaticProps() {
	const markdown = fs.readFileSync(path.join(process.cwd(), "content", "privacy.md"), "utf8");
	const processed = await remark().use(remarkGfm).use(remarkHtml).process(markdown);
	const html = processed.toString();
	const titleHtml = html.match(/<h1>([\s\S]*?)<\/h1>/)?.[1] ?? "";
	const sections: PrivacyProps["sections"] = [];
	const references = new Map<string, string>();
	// Change subsection labels for display only; keep the source policy intact.
	const numberedHtml = html.replace(/<h1>[\s\S]*?<\/h1>\n?/, "").replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_, level: string, heading: string) => {
		const id = `policy-section-${sections.length + 1}`;
		if (level === "3") {
			heading = heading.replace(/^(\d+)\.(\d+)\s+/, (_, parent: string, subsection: string) => {
				let subsectionNumber = Number(subsection);
				let letter = "";
				while (subsectionNumber > 0) {
					subsectionNumber--;
					letter = String.fromCharCode(65 + (subsectionNumber % 26)) + letter;
					subsectionNumber = Math.floor(subsectionNumber / 26);
				}
				references.set(`${parent}.${subsection}`, `${parent} (${letter})`);
				return `${parent}. (${letter}) `;
			});
		}
		sections.push({ id, html: heading, level: Number(level) });
		return `<h${level} id="${id}">${heading}</h${level}>`;
	});
	// Keep in-text section references consistent with the displayed labels.
	const contentHtml = numberedHtml.replace(
		/(\bsection\s+)(\d+\.\d+)\b/g,
		(_, prefix: string, reference: string) => `${prefix}${references.get(reference) ?? reference}`
	);
	return { props: { titleHtml, contentHtml, sections } };
}

export default function Privacy({ titleHtml, contentHtml, sections }: PrivacyProps) {
	return (
		<div className={styles.privacy}>
			<Head>
				<title>Privacy Policy | The Tower</title>
				<meta property="og:title" content="Privacy Policy | The Tower" />
				<meta property="og:description" content="Privacy policy for the PHS Tower mobile app" />
			</Head>
			<div className={styles.inner}>
				<header className={styles.heading}>
					<h1 dangerouslySetInnerHTML={{ __html: titleHtml }} />
				</header>
				<div className={styles.layout}>
					<article className={styles.policy} dangerouslySetInnerHTML={{ __html: contentHtml }} />
					<aside className={styles.contents}>
						<h2 id="policy-contents">Table of Contents</h2>
						<div role="navigation" aria-labelledby="policy-contents" className={styles.contentsLinks}>
							<ul>
								{sections.map(section => (
									<li key={section.id} className={section.level === 3 ? styles.subsection : undefined}>
										<a href={`#${section.id}`} dangerouslySetInnerHTML={{ __html: section.html }} />
									</li>
								))}
							</ul>
						</div>
					</aside>
				</div>
			</div>
		</div>
	);
}
