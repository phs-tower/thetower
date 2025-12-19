/** @format */

import { spreads } from "@prisma/client";
import Head from "next/head";
import { getSpread } from "~/lib/queries";
import Link from "next/link";
import styles from "./spread.module.scss";
import { ReturnToCategoryButton } from "~/pages/articles/[year]/[month]/[cat]/[slug]";

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

export function SpreadContent({ spread }: Props) {
	return (
		<section className={styles["content"]}>
			<h1>{spread.title}</h1>
			<div className={styles["pdf-container"]}>
				<object data={spread.src} type="application/pdf" width="100%" height="100%">
					{spread.src.length < 200 && (
						<>
							This browser does not support PDFs. Please download the PDF to view it:{" "}
							<Link href={spread.src} target="_blank">
								Download PDF
							</Link>
						</>
					)}
				</object>
			</div>
		</section>
	);
}

export default function SpreadPage({ spread }: Props) {
	return (
		<>
			<Head>
				<title>{`${spread.title} | The Tower`}</title>
				<meta property="og:title" content={`${spread.title} | The Tower`} />
				<meta property="og:description" content="Read more about this article!" />
			</Head>

			<ReturnToCategoryButton category="vanguard" />

			<SpreadContent spread={spread} />
		</>
	);
}
