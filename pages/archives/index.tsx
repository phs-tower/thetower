/** @format */

import Head from "next/head";
import VirtualArchive from "~/components/archive.client";
import { getPublishedArchiveIssues } from "~/lib/queries";

import styles from "./archives.module.scss";

interface IssueDate {
	year: number;
	month: number;
}

interface Props {
	availableIssues: IssueDate[];
}

export async function getStaticProps() {
	return {
		props: {
			availableIssues: await getPublishedArchiveIssues(),
		},
		revalidate: 60,
	};
}

function ArchiveList({ availableIssues }: Props) {
	let outer = [];
	const issueSet = new Set(availableIssues.map(issue => `${issue.year}-${issue.month}`));
	const years = [...new Set(availableIssues.map(issue => issue.year))].sort((a, b) => b - a);

	for (const year of years) {
		const yearIssues = availableIssues
			.filter(issue => issue.year === year && issueSet.has(`${issue.year}-${issue.month}`))
			.sort((a, b) => b.month - a.month);
		const container = yearIssues.map((issue, index) => (
			<VirtualArchive key={`${issue.year}-${issue.month}`} month={issue.month} year={issue.year} issueNumber={index + 1} />
		));

		if (!container.length) continue;
		outer.push(
			<section className={styles.yearSection} key={year}>
				<div className={styles.yearHeader}>
					<h2>{year}</h2>
					<p>
						{container.length} issue{container.length === 1 ? "" : "s"}
					</p>
				</div>
				<div className={styles.container}>{container}</div>
			</section>
		);
	}

	return <>{outer}</>;
}

export default function Archives({ availableIssues }: Props) {
	return (
		<div className={styles.archives}>
			<Head>
				<title>Virtual Archives | The Tower</title>
				<meta property="og:title" content="Archives | The Tower" />
				<meta property="og:description" content="Read scanned PDF newspapers here" />
			</Head>
			<header className={styles.hero}>
				<p className={styles.eyebrow}>Print and Issue Archive</p>
				<h1>Archives</h1>
				<p className={styles.description}>
					Browse past Tower issues by month. Each archive opens the issue landing page with featured stories, section lists, and the digital
					copy when available.
				</p>
			</header>
			<ArchiveList availableIssues={availableIssues}></ArchiveList>
		</div>
	);
}
