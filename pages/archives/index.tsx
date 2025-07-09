/** @format */

import Head from "next/head";
import VirtualArchive from "~/components/archive.client";

function ArchiveList() {
	let outer = [];
	const currYear = new Date().getFullYear();
	const currMonth = new Date().getMonth();
	for (let year: number = 2022; year <= currYear; year++) {
		const container = [];
		for (let month of [2, 3, 4, 6, 9, 10, 11, 12]) {
			if (year == currYear && month >= currMonth) continue;

			container.push(<VirtualArchive key={month} month={month} year={year} />);
		}

		if (!container.length) continue;
		outer.push(<h2 key={year * 2}>{year}</h2>);
		outer.push(
			<div className="container" key={year * 2 + 1}>
				{container}
			</div>
		);
	}

	return <>{outer}</>;
}

export default function Archives() {
	return (
		<div className="archives">
			<Head>
				<title>Virtual Archives | The Tower</title>
				<meta property="og:title" content="Archives | The Tower" />
				<meta property="og:description" content="Read scanned PDF newspapers here" />
			</Head>
			<style jsx>{`
				h1,
				h2 {
					text-align: center;
				}

				.container {
					margin-left: 10%;
					width: 80%;
					display: grid;
					grid-template-columns: 1fr 1fr 1fr 1fr;
				}

				@media (max-width: 1000px) {
					.container {
						grid-template-columns: 1fr;
						margin: 0 auto;
					}
				}
			`}</style>
			<h1>Archives</h1>
			<br></br>
			{/* i think the react-y way to do this is a for loop hol up lemme do rq */}
			<ArchiveList></ArchiveList>
		</div>
	);
}
