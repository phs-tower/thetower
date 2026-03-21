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
		const container = [];
		for (let month of [12, 11, 10, 9, 6, 4, 3, 2]) {
			if (!issueSet.has(`${year}-${month}`)) continue;

			container.push(<VirtualArchive key={month} month={month} year={year} />);
		}

		if (!container.length) continue;
		outer.push(<h2 key={year * 2}>{year}</h2>);
		outer.push(
			<div className={styles.container} key={year * 2 + 1}>
				{container}
			</div>
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
			<h1>Archives</h1>
			<br></br>
			<ArchiveList availableIssues={availableIssues}></ArchiveList>
		</div>
	);
}
