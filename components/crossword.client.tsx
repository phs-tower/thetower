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
	}, [puzzleInput]);

	const [state, dispatch] = useMutativeReducer(crosswordStateReducer, initialState);
	const inputRef = useRef<HTMLInputElement>(null);
	const focused = typeof window !== "undefined" ? inputRef.current === document.activeElement : false;

	// Increase this if you want even bigger cells once zoomed in
	const cellSize = 30;
	const hasMutatedRef = useRef(false);

	const date = useMemo(() => new Date(puzzleInput.date), [puzzleInput.date]);

	const won = useMemo(() => state.grid.every(row => row.every(cell => (cell.used ? cell.answer === cell.guess : true))), [state.grid]);

	useEffect(() => {
		if (won) {
			dispatch({ type: "setWon", to: true });
		}
	}, [won, dispatch]);

	// Identify the selected clue from the current position
	const selectedClue = useMemo(() => {
		if (!focused) return null;
		const { row, col } = state.position;

		return state.direction === "across"
			? state.clues.across.find(clue => row === clue.row && col >= clue.col && col < clue.col + clue.answer.length) ?? null
			: state.clues.down.find(clue => col === clue.col && row >= clue.row && row < clue.row + clue.answer.length) ?? null;
	}, [focused, state.position, state.direction, state.clues]);

	// Save puzzle state in localStorage
	useEffect(() => {
		if (hasMutatedRef.current) {
			const serializedState = JSON.stringify(state);
			localStorage.setItem("crosswordGameState", serializedState);
		}
	}, [state.grid, state.seconds, state.autocheck, state.paused, state.won]);

	// Load puzzle state from localStorage on mount
	useEffect(() => {
		const savedState = localStorage.getItem("crosswordGameState");
		if (savedState) {
			dispatch({ type: "loadState", state: JSON.parse(savedState) });
		}
		hasMutatedRef.current = true;
	}, [dispatch]);

	// Dispatch wrapper to track changes
	const dispatchWithTracking = useCallback(
		(action: Action) => {
			dispatch(action);
			hasMutatedRef.current = true;
		},
		[dispatch]
	);

	// Simple timer
	useEffect(() => {
		const intervalId = setInterval(() => {
			if (!won) {
				dispatchWithTracking({ type: "tick" });
			}
		}, 1000);

		return () => clearInterval(intervalId);
	}, [won, dispatchWithTracking]);

	/**
	 * Compute the bounding box of all squares (used or black)
	 * so we can “zoom in” on that portion only.
	 */
	const { minRow, maxRow, minCol, maxCol } = useMemo(() => {
		let minR = Number.MAX_VALUE;
		let maxR = 0;
		let minC = Number.MAX_VALUE;
		let maxC = 0;

		state.grid.forEach((row, r) => {
			row.forEach((cell, c) => {
				// If it's either used or about to be drawn as black
				// we include it in the bounding box
				if (cell.used || !cell.used) {
					if (r < minR) minR = r;
					if (r > maxR) maxR = r;
					if (c < minC) minC = c;
					if (c > maxC) maxC = c;
				}
			});
		});

		// Fallback if puzzle is empty (shouldn't happen)
		if (minR === Number.MAX_VALUE) {
			return { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 };
		}
		return { minRow: minR, maxRow: maxR, minCol: minC, maxCol: maxC };
	}, [state.grid]);

	// The width & height of just the puzzle region
	const puzzleWidth = (maxCol - minCol + 1) * cellSize;
	const puzzleHeight = (maxRow - minRow + 1) * cellSize;

	// We'll shift the drawing logic by minRow, minCol in the <g> transform
	// and set the <svg> viewBox to just the bounding box region
	const viewBox = `${0} ${0} ${puzzleWidth} ${puzzleHeight}`;

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
					border: 0.25px solid black;
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
			`}</style>

			<div className="title-container">
				<h1>The Crossword</h1>
				<p style={{ fontFamily: styles.font.sans }}>
					By {puzzleInput.author} on {date.toLocaleDateString()}
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
					<p>Brag about your time to your friends...</p>
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
						<svg className="crossword-svg" viewBox={viewBox}>
							{/* We'll shift all cells so (minRow, minCol) is at 0,0 */}
							<g transform={`translate(${-minCol * cellSize}, ${-minRow * cellSize})`}>
								{state.grid.map((row, r) =>
									row.map((cell, c) => {
										const key = `${r}-${c}`;
										if (!cell.used) {
											// Draw black squares
											return (
												<rect
													key={`black-${key}`}
													x={c * cellSize}
													y={r * cellSize}
													width={cellSize}
													height={cellSize}
													fill="black"
													stroke="#555"
													strokeWidth={0.6}
												/>
											);
										} else {
											// Draw normal squares
											return (
												<Cell
													key={key}
													guess={cell.guess}
													answer={cell.answer}
													num={cell.num}
													isSelected={focused && r === state.position.row && c === state.position.col}
													isHighlighted={
														state.direction === "across"
															? selectedClue?.row === r &&
															  c >= (selectedClue?.col ?? 0) &&
															  c < (selectedClue?.col ?? 0) + (selectedClue?.answer.length ?? 0)
															: selectedClue?.col === c &&
															  r >= (selectedClue?.row ?? 0) &&
															  r < (selectedClue?.row ?? 0) + (selectedClue?.answer.length ?? 0)
													}
													isWrong={state.autocheck && cell.guess != null && cell.guess !== cell.answer}
													onClick={() => {
														dispatchWithTracking({
															type: "selectCell",
															row: r,
															col: c,
														});
														inputRef.current?.focus();
													}}
													size={cellSize}
													x={c}
													y={r}
												/>
											);
										}
									})
								)}
							</g>
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

/** ========== Cell Component ========== */
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
			<rect x={x * size} y={y * size} width={size} height={size} fill={fillColor} stroke="#555" strokeWidth={0.6} />
			{num && (
				<text x={x * size + 6} y={y * size + 8} fontSize={size * 0.3} dominantBaseline="left" textAnchor="middle" fill="black">
					{num}
				</text>
			)}
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

/** ========== Timer Formatting ========== */
function formatSeconds(seconds: number): string {
	if (seconds < 0) {
		return "Invalid input: Please provide a non-negative number of seconds.";
	}
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainingSeconds = Math.floor(seconds % 60);

	if (hours === 0) {
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	} else {
		return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
	}
}

/** ========== MenuBar Component ========== */
type MenuBarProps = {
	seconds: number;
	paused: boolean;
	autocheck: boolean;
	won: boolean;
	onTogglePaused?: () => void;
	onReset?: () => void;
	onToggleAutocheck?: () => void;
};

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
					/* style as needed */
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
			<div className="left-side">
				<button className="button" onClick={onTogglePaused}>
					{paused ? "Play" : "Pause"}
				</button>
				<div className="timer" style={{ fontSize: "1.6rem" }}>
					{formatSeconds(seconds)}
				</div>
			</div>
			<div className="buttons">
				<button className="button" onClick={() => onToggleAutocheck?.()}>
					{autocheck ? "Autocheck: On" : "Autocheck: Off"}
				</button>
				<button className="button" onClick={onReset}>
					Reset
				</button>
			</div>
		</div>
	);
}

/** ========== Clues Section ========== */
type CluesSectionProps = {
	title: string;
	clues: RuntimeClue[];
};

function CluesSection({ clues, title }: CluesSectionProps): JSX.Element {
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
					margin: 0;
				}
				li {
					margin-bottom: 10px;
					font-size: 1.6rem;
				}
				.clue-number {
					margin-right: 5px;
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

/** ========== Selected Clue Panel ========== */
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
				}
			`}</style>
			<div className="clue-ref">
				<b>{clue ? clue.num + direction.charAt(0).toUpperCase() : ""}</b>
			</div>
			<p>{clue?.clue ?? ""}</p>
		</div>
	);
}
