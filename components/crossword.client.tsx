/** @format */

import { useMutativeReducer } from "use-mutative";
import { Action, CrosswordDispatchContext, crosswordStateReducer, initialStateFromInput } from "lib/crossword/state";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Direction, PuzzleInput, RuntimeClue } from "~/lib/crossword/types";
import React from "react";
import styles from "~/lib/styles";
import SubBanner from "~/components/subbanner.client";
import Link from "next/link";

type Props = { puzzleInput: PuzzleInput };

export default function CrosswordGame({ puzzleInput }: Props) {
	const initialState = useMemo(() => {
		return initialStateFromInput(puzzleInput);
	}, []);

	const [state, dispatch] = useMutativeReducer(crosswordStateReducer, initialState);
	const inputRef = useRef<HTMLInputElement>(null);
	const focused = typeof window !== "undefined" ? inputRef.current == document.activeElement : false;
	const cellSize = 30;
	const hasMutatedRef = useRef(false);

	const date = useMemo(() => {
		return new Date(puzzleInput.date);
	}, []);

	const won = useMemo(() => {
		return state.grid.every(c => c.every(cell => (cell.used ? cell.answer == cell.guess : true)));
	}, [state.grid]);

	useEffect(() => {
		if (won == true) {
			dispatch({ type: "setWon", to: true });
		}
	}, [won]);

	// Function to find the clue associated with the selected cell
	const selectedClue = useMemo(() => {
		if (!focused) {
			return null;
		}
		const { row, col } = state.position;

		const clue =
			state.direction == "across"
				? state.clues.across.find(clue => row === clue.row && col >= clue.col && col < clue.col + clue.answer.length) ?? null
				: state.clues.down.find(clue => col === clue.col && row >= clue.row && row < clue.row + clue.answer.length) ?? null;

		return clue;
	}, [state.position, state.direction, state.clues]);

	useEffect(() => {
		if (hasMutatedRef.current) {
			console.log("saving");
			const serializedState = JSON.stringify(state);
			localStorage.setItem("crosswordGameState", serializedState);
		}
	}, [state.grid, state.seconds]);

	useEffect(() => {
		console.log("loading");
		const savedState = localStorage.getItem("crosswordGameState");
		if (savedState) {
			const parsedState = JSON.parse(savedState);
			dispatch({ type: "loadState", state: parsedState });
		}
	}, []);

	const dispatchWithTracking = useCallback(
		(action: Action) => {
			dispatch(action);
			hasMutatedRef.current = true;
		},
		[dispatch]
	);

	useEffect(() => {
		const intervalId = setInterval(() => {
			if (!won) {
				dispatchWithTracking({ type: "tick" });
			}
		}, 1000);

		return () => clearInterval(intervalId);
	}, [won]);

	return (
		<CrosswordDispatchContext.Provider value={dispatchWithTracking}>
			<style jsx>{`
				.crossword-container {
					display: flex;
					align-items: flex-start;
				}

				.crossword-svg {
					width: min(50vw, 75vh);
					height: min(50vw, 75vh);
					user-select: none;
					cursor: default;
					margin-top: 8px;
				}

				@media (max-width: 850px) {
					.crossword-container {
						flex-direction: column;
					}

					.crossword-svg {
						width: 90vw;
						height: 90vw;
					}
				}

				.clues-container {
					display: flex;
					flex-direction: row;
					gap: 20px;
					margin-left: 20px;
					width: 100%;
				}

				.title-container h3 {
					/* font-family: ${styles.font.stack};
					font-weight: 300; */
				}
			`}</style>
			<div className="title-container">
				<h1>The Crossword</h1>
				<p style={{ fontFamily: styles.font.sans }}>
					By {puzzleInput.author} on {date.toLocaleString("en-us", { timeZone: "America/New_York", dateStyle: "long" })}
				</p>
			</div>
			<MenuBar
				seconds={state.seconds}
				autocheck={state.autocheck}
				paused={state.paused}
				won={won}
				onReset={() => dispatchWithTracking({ type: "resetGrid", puzzleInput: puzzleInput })}
				onToggleAutocheck={() => dispatch({ type: "toggleAutocheck" })}
				onTogglePaused={() => dispatch({ type: "togglePaused" })}
			/>

			{state.paused ? (
				<div>
					<h1>Game Paused</h1>
					<p>Click play to resume the game</p>
				</div>
			) : state.won ? (
				<div>
					<h1>You won!</h1>
					<p>Brag about yout time to your friends...</p>
				</div>
			) : (
				<div className="crossword-container">
					<input
						ref={inputRef}
						type="text"
						className="hidden-input"
						onKeyDown={e => dispatchWithTracking({ type: "keyDown", key: e.key })}
						style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
					/>
					<div>
						<SelectedCluePanel clue={selectedClue ?? undefined} direction={state.direction} />
						<svg
							className="crossword-svg"
							viewBox={`0 0 ${state.cols * cellSize} ${state.rows * cellSize}`}
							style={{ border: "0.25px solid black", backgroundColor: "black" }}
						>
							{state.grid.map((row, rowIndex) =>
								row.map(
									(cell, colIndex) =>
										cell.used && (
											<Cell
												key={`${rowIndex}-${colIndex}`}
												guess={cell.guess}
												answer={cell.answer}
												num={cell.num}
												isSelected={focused && rowIndex == state.position.row && colIndex == state.position.col}
												isHighlighted={
													state.direction == "across"
														? selectedClue?.row == rowIndex &&
														  colIndex >= selectedClue?.col &&
														  colIndex < selectedClue?.col + selectedClue?.answer.length
														: selectedClue?.col == colIndex &&
														  rowIndex >= selectedClue?.row &&
														  rowIndex < selectedClue?.row + selectedClue?.answer.length
												}
												isWrong={state.autocheck && cell.guess != null && cell.guess != cell.answer}
												onClick={() => {
													console.log("cloick");
													dispatchWithTracking({ type: "selectCell", row: rowIndex, col: colIndex });
													inputRef.current?.focus();
												}}
												size={cellSize}
												x={colIndex}
												y={rowIndex}
											/>
										)
								)
							)}
						</svg>
					</div>
					<div className="clues-container">
						<CluesSectionMemo clues={state.clues.across} title="Across" />
						<CluesSectionMemo clues={state.clues.down} title="Down" />
					</div>
				</div>
			)}
			<br />
			<Link href="/games/crossword/archive">
				<p>Explore more at our archives &#x21E8;</p>
			</Link>
			<SubBanner title="Enjoyed the crossword? Consider subscribing." />
		</CrosswordDispatchContext.Provider>
	);
}

type CellProps = {
	guess?: string;
	answer: string;
	onClick: () => void;
	isSelected: boolean;
	isHighlighted: boolean;
	isWrong: boolean;
	size: number;
	num?: string;
	x: number;
	y: number;
};

function Cell({ guess, answer, isSelected, isHighlighted, isWrong, size, x, y, onClick, num }: CellProps): JSX.Element {
	const fillColor = isSelected ? "#FFD700" : isHighlighted ? "#9dd9fa" : "white";

	return (
		<g onClick={onClick}>
			<rect x={x * size} y={y * size} width={size} height={size} fill={fillColor} stroke="#555555" strokeWidth={0.6} />
			<text x={x * size + 6} y={y * size + 8} fontSize={size * 0.3} dominantBaseline="left" textAnchor="middle" fill="black">
				{num}
			</text>
			<text
				x={x * size + size / 2}
				y={y * size + (size / 3) * 2}
				dominantBaseline="middle"
				textAnchor="middle"
				fontSize={size * 0.6}
				fill="black"
			>
				{guess}
			</text>
			{isWrong && <line x1={x * size} y1={(y + 1) * size} x2={(x + 1) * size} y2={y * size} stroke="red" strokeWidth="0.5" />}
		</g>
	);
}

function formatSeconds(seconds: number): string {
	if (seconds < 0) {
		return "Invalid input: Please provide a non-negative number of seconds.";
	}

	const hours: number = Math.floor(seconds / 3600);
	const minutes: number = Math.floor((seconds % 3600) / 60);
	const remainingSeconds: number = Math.floor(seconds % 60);

	if (hours === 0) {
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	} else {
		return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
	}
}

type MenuBarProps = {
	seconds: number;
	paused: boolean;
	autocheck: boolean;
	won: boolean;

	onTogglePaused?: () => void;
	onReset?: () => void;
	onToggleAutocheck?: () => void;
};

// MenuBar component with toggle button for autocheck and reset button
function MenuBar({ seconds, paused, autocheck, onTogglePaused, onReset, onToggleAutocheck, won }: MenuBarProps) {
	return (
		<div className="menu-bar">
			<style jsx>{`
				.menu-bar {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding: 10px;
					border-top: #dddddd 1px solid;
					border-bottom: #dddddd 1px solid;
					margin-top: 10px;
					margin-bottom: 10px;
				}
				.timer {
					/* font-size: 18px;
					font-weight: bold; */
				}
				.buttons {
					display: flex;
					gap: 10px;
				}
				.button {
					padding: 8px 16px;
					background-color: #007bff;
					color: white;
					border: none;
					border-radius: 4px;
					cursor: pointer;
				}
				.button:hover {
					background-color: #0056b3;
				}
				.left-side {
					display: flex;
					flex-direction: row;
					align-items: center;
					gap: 10px;
				}
			`}</style>
			<div className={"left-side"}>
				<button className="button" onClick={onTogglePaused}>
					{paused ? "Play" : "Pause"}
				</button>
				<div className="timer" style={{ fontSize: "1rem" }}>
					{formatSeconds(seconds)}
				</div>
			</div>
			<div className="buttons">
				<button className="button" onClick={() => onToggleAutocheck && onToggleAutocheck()}>
					{autocheck ? "Autocheck: On" : "Autocheck: Off"}
				</button>
				<button className="button" onClick={onReset}>
					Reset
				</button>
			</div>
		</div>
	);
}

type CluesSectionProps = {
	title: string;
	clues: RuntimeClue[];
};

function CluesSection({ clues, title }: CluesSectionProps): JSX.Element {
	console.log("rerendering clues");
	return (
		<div className="clues-section">
			<style jsx>{`
				.clues-section {
					flex: 1;
					display: flex;
					flex-direction: column;
					max-width: 100%;
				}
				ul {
					list-style: none;
					padding: 0;
					margin: 0; /* Remove default margin */
				}

				li {
					margin-bottom: 10px; /* Adjust the margin as needed */
					font-size: 1rem;
				}

				.clue-number {
					margin-right: 5px; /* Adjust the margin as needed */
				}

				h2 {
					padding-bottom: 10px;
				}
			`}</style>
			<h2>{title}</h2>
			<ul>
				{clues.map((clue: RuntimeClue) => (
					<li key={clue.num}>
						<span className="clue-number">{clue.num}</span> {clue.clue}
					</li>
				))}
			</ul>
		</div>
	);
}

const CluesSectionMemo = React.memo(CluesSection);

type SelectedCluePanelProps = {
	clue?: RuntimeClue;
	direction: Direction;
};

function SelectedCluePanel({ clue, direction }: SelectedCluePanelProps) {
	return (
		<div className="panel">
			<style jsx>{`
				.panel {
					height: 70px;
					width: 100%;
					background-color: #9dd9fa99;
					display: flex;
					align-items: center;
					flex-direction: row;
				}

				.clue-ref {
					width: 70px;
					display: flex;
					align-items: center;
					justify-content: center;
					/* font-size: 16px; */
				}
			`}</style>
			<div className="clue-ref">
				<b>{clue && clue.num + direction.charAt(0).toUpperCase()}</b>
			</div>
			<p>{clue && clue.clue}</p>
		</div>
	);
}
