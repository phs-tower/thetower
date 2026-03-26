/** @format */

import Head from "next/head";
import { GetStaticProps } from "next";
import CrosswordArchiveSection, { CrosswordSummary } from "~/components/crosswordarchive.client";
import { getCrosswords, getIdOfNewestCrossword } from "~/lib/queries";

interface Props {
	crosswords: CrosswordSummary[];
}

export const getStaticProps: GetStaticProps<Props> = async () => {
	return {
		props: { crosswords: await getCrosswords(12, await getIdOfNewestCrossword(), 0) },
		revalidate: 60,
	};
};

export default function Archive(props: Props) {
	return (
		<>
			<Head>
				<meta property="og:title" content="Crossword Archive | The Tower" />
				<meta property="og:description" content="The Tower is Princeton High School's newspaper club." />
			</Head>
			<CrosswordArchiveSection
				initialCrosswords={props.crosswords}
				heading="Crossword Archive"
				description="Open any older Tower crossword from the archive below."
			/>
		</>
	);
}
