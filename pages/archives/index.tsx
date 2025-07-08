/** @format */

import Head from "next/head";
import VirtualArchive from "~/components/archive.client";

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
					/* font-weight: 600; */
				}

				h1 {
					/* font-weight: bold; */
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
			<h2>2025</h2>
			<div className="container">
				<VirtualArchive month={2} year={2025} />
				<VirtualArchive month={3} year={2025} />
				{/*

				<VirtualArchive month={4} year={2025} />
				<VirtualArchive month={6} year={2025} />
				<VirtualArchive month={9} year={2025} />
				<VirtualArchive month={10} year={2025} />
				<VirtualArchive month={11} year={2025} />
				<VirtualArchive month={12} year={2025} /> 
				*/}
			</div>

			<h2>2024</h2>
			<div className="container">
				<VirtualArchive month={2} year={2024} />
				<VirtualArchive month={3} year={2024} />
				<VirtualArchive month={4} year={2024} />
				<VirtualArchive month={6} year={2024} />
				<VirtualArchive month={9} year={2024} />
				<VirtualArchive month={10} year={2024} />
				<VirtualArchive month={11} year={2024} />
				<VirtualArchive month={12} year={2024} />
			</div>
			<h2>2023</h2>
			<div className="container">
				<VirtualArchive month={2} year={2023} />
				<VirtualArchive month={3} year={2023} />
				<VirtualArchive month={4} year={2023} />
				<VirtualArchive month={6} year={2023} />
				<VirtualArchive month={9} year={2023} />
				<VirtualArchive month={10} year={2023} />
				<VirtualArchive month={11} year={2023} />
				<VirtualArchive month={12} year={2023} />
			</div>
			<br></br>
			<h2>2022</h2>
			<div className="container">
				<VirtualArchive month={2} year={2022} />
				<VirtualArchive month={3} year={2022} />
				<VirtualArchive month={4} year={2022} />
				<VirtualArchive month={6} year={2022} />
				<VirtualArchive month={9} year={2022} />
				<VirtualArchive month={10} year={2022} />
				<VirtualArchive month={11} year={2022} />
				<VirtualArchive month={12} year={2022} />
			</div>
			<br></br>
			<h2>2021</h2>
			<div className="container">
				<VirtualArchive month={2} year={2021} />
				<VirtualArchive month={3} year={2021} />
				<VirtualArchive month={4} year={2021} />
				<VirtualArchive month={6} year={2021} />
				<VirtualArchive month={9} year={2021} />
				<VirtualArchive month={10} year={2021} />
				<VirtualArchive month={11} year={2021} />
				<VirtualArchive month={12} year={2021} />
			</div>
			<br></br>
			<h2>2020</h2>
			<div className="container">
				<VirtualArchive month={2} year={2020} />
				<VirtualArchive month={3} year={2020} />
				<VirtualArchive month={4} year={2020} />
				<VirtualArchive month={6} year={2020} />
				<VirtualArchive month={9} year={2020} />
				<VirtualArchive month={10} year={2020} />
				<VirtualArchive month={11} year={2020} />
				<VirtualArchive month={12} year={2020} />
			</div>
		</div>
	);
}
