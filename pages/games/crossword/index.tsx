/** @format */

import { GetServerSidePropsResult } from "next";
import { GetStaticProps } from "next";
import { getCurrentCrossword } from "~/lib/queries";
import CrosswordGame from "~/components/crossword.client";
import { PuzzleInput } from "~/lib/crossword/types";

type Props = { puzzleInput: PuzzleInput };

export const getStaticProps: GetStaticProps<Props> = async () => {
	const puzzleInput = await getCurrentCrossword();
	if (!puzzleInput) {
		return {
			notFound: true,
			revalidate: 60,
		};
	}

	return {
		props: {
			puzzleInput,
		},
		revalidate: 60,
	};
};

export default function Game(props: Props) {
	return <CrosswordGame puzzleInput={props.puzzleInput} />;
}
