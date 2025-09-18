/** @format */

import Head from "next/head";
import VirtualArchive from "~/components/archive.client";

import styles from "./archives.module.scss";

function ArchiveList() {
	let outer = [];
	const currYear = new Date().getFullYear();
	const currMonth = new Date().getMonth() + 1;
	for (let year: number = currYear; year >= 2022; year--) {
		const container = [];
		for (let month of [12, 11, 10, 9, 6, 4, 3, 2]) {
			if (year == currYear) console.log(month, currMonth);
			if (year == currYear && month > currMonth) continue;

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

export default function Archives() {
	return (
		<div className={styles.archives}>
			<Head>
				<title>Virtual Archives | The Tower</title>
				<meta property="og:title" content="Archives | The Tower" />
				<meta property="og:description" content="Read scanned PDF newspapers here" />
			</Head>
			<h1>Archives</h1>
			<br></br>
			<ArchiveList></ArchiveList>
		</div>
	);
}
