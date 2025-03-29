/** @format */

import { spreads } from "@prisma/client";
import Head from "next/head";
import { getSpread } from "~/lib/queries";

interface Props {
	spread: spreads;
}

interface Params {
	params: {
		slug: string;
	};
}

export async function getServerSideProps({ params }: Params) {
	return {
		props: {
			spread: await getSpread(params.slug),
		},
	};
}

export default function SpreadPage({ spread }: Props) {
	return (
		<div className="spread">
			<Head>
				<title>{`${spread.title} | The Tower`}</title>
				<meta property="og:title" content={`${spread.title} | The Tower`} />
				<meta property="og:description" content="Read more about this article!" />
			</Head>
			<style jsx>{`
				.spread {
					display: flex;
					flex-direction: column;
					align-items: center;
				}
				.pdf-container {
					width: 60vw;
					height: 100vh;
					border: none;
				}
			`}</style>
			<h1>{spread.title}</h1>
			<div className="pdf-container">
				<object data={spread.src} type="application/pdf" width="100%" height="100%">
					<iframe src={spread.src} width="100%" height="100%" style={{ border: "none" }}>
						This browser does not support PDFs. Please download the PDF to view it: <a href={spread.src}>Download PDF</a>
					</iframe>
				</object>
			</div>
		</div>
	);
}
