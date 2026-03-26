/** @format */

import Head from "next/head";
import { GetStaticPaths, GetStaticProps } from "next";
import CrosswordArchiveSection, { CrosswordSummary } from "~/components/crosswordarchive.client";
import CrosswordGame from "~/components/crossword.client";
import SubBanner from "~/components/subbanner.client";
import { getCrosswordById, getCrosswords, getIdOfNewestCrossword } from "~/lib/queries";
import { PuzzleInput } from "~/lib/crossword/types";
import { ParsedUrlQuery } from "querystring";

type Props = {
	puzzleInput: PuzzleInput;
	archiveCrosswords: CrosswordSummary[];
};

interface Params extends ParsedUrlQuery {
	id: string;
}

export const getStaticPaths: GetStaticPaths<Params> = async () => ({
	paths: [],
	fallback: "blocking",
});

export const getStaticProps: GetStaticProps<Props, Params> = async ({ params }) => {
	if (!params) return { notFound: true };

	const id = parseInt(params.id);
	if (isNaN(id)) return { notFound: true };

	const [crossword, newestCrosswordId] = await Promise.all([getCrosswordById(id), getIdOfNewestCrossword()]);
	if (crossword == null) return { notFound: true, revalidate: 60 };

	const archiveCrosswords = newestCrosswordId
		? (await getCrosswords(12, newestCrosswordId, 0)).filter(crosswordSummary => crosswordSummary.id !== id)
		: [];

	return {
		props: {
			puzzleInput: crossword,
			archiveCrosswords,
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
			<CrosswordArchiveSection initialCrosswords={archiveCrosswords} heading="Archive" description="Browse other Tower crosswords below." />
			<SubBanner title="Enjoyed the crossword? Consider subscribing." />
		</>
	);
}
