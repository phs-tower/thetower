/** @format */

import { GetServerSidePropsResult } from "next";
import { GetStaticProps } from "next";
import { getCurrentCrossword } from "~/lib/queries";
import CrosswordGame from "~/components/crossword.client";
import { PuzzleInput } from "~/lib/crossword/types";

type Props = { puzzleInput: PuzzleInput };

export const getStaticProps: GetStaticProps<Props> = async () => {
	return {
		props: {
			puzzleInput: await getCurrentCrossword(),
		},
		revalidate: 60,
	};
};

export default function Game(props: Props) {
	return <CrosswordGame puzzleInput={props.puzzleInput} />;
}
