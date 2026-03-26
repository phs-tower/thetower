/** @format */

import Head from "next/head";
import { GetStaticProps } from "next";
import CrosswordArchiveSection, { CrosswordSummary } from "~/components/crosswordarchive.client";
import CrosswordGame from "~/components/crossword.client";
import SubBanner from "~/components/subbanner.client";
import { getCrosswords, getCurrentCrossword, getIdOfNewestCrossword } from "~/lib/queries";
import { PuzzleInput } from "~/lib/crossword/types";

type Props = {
	puzzleInput: PuzzleInput;
	archiveCrosswords: CrosswordSummary[];
};

export const getStaticProps: GetStaticProps<Props> = async () => {
	const puzzleInput = await getCurrentCrossword();
	const newestCrosswordId = await getIdOfNewestCrossword();
	if (!puzzleInput) {
		return {
			notFound: true,
			revalidate: 60,
		};
	}

	return {
		props: {
			puzzleInput,
			archiveCrosswords: newestCrosswordId ? await getCrosswords(6, newestCrosswordId, 1) : [],
		},
		revalidate: 60,
	};
};

export default function Game({ puzzleInput, archiveCrosswords }: Props) {
	const metaTitle = `${puzzleInput.title} | The Tower`;

	return (
		<>
			<Head>
				<title>{metaTitle}</title>
				<meta property="og:title" content={metaTitle} />
				<meta property="og:description" content={`Play "${puzzleInput.title}" by ${puzzleInput.author} and browse past Tower crosswords.`} />
			</Head>
			<CrosswordGame key={puzzleInput.date} puzzleInput={puzzleInput} showArchiveTeaser={false} showSubscribePromo={false} />
			<CrosswordArchiveSection
				initialCrosswords={archiveCrosswords}
				heading="Archive"
				description="Browse earlier crosswords below. The newest puzzle is always shown first on this page."
			/>
			<SubBanner title="Enjoyed the crossword? Consider subscribing." />
		</>
	);
}
