/** @format */

import { GetStaticPaths, GetStaticProps } from "next";
import { getCrosswordById } from "~/lib/queries";
import CrosswordGame from "~/components/crossword.client";
import { PuzzleInput } from "~/lib/crossword/types";
import { ParsedUrlQuery } from "querystring";

type Props = { puzzleInput: PuzzleInput };

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

	const crossword = await getCrosswordById(id);
	if (crossword == null) return { notFound: true, revalidate: 60 };
	return {
		props: {
			puzzleInput: crossword,
		},
		revalidate: 60,
	};
};

export default function Game(props: Props) {
	return <CrosswordGame puzzleInput={props.puzzleInput} />;
}
