/** @format */

import { GetServerSidePropsResult } from "next";
import { getCurrentCrossword } from "~/lib/queries";
import CrosswordGame from "~/components/crossword.client";
import { PuzzleInput } from "~/lib/crossword/types";

type Props = { puzzleInput: PuzzleInput };

export async function getServerSideProps(): Promise<GetServerSidePropsResult<Props>> {
	return {
		props: {
			puzzleInput: await getCurrentCrossword(),
		},
	};
}

export default function Game(props: Props) {
	return <CrosswordGame puzzleInput={props.puzzleInput} />;
}
