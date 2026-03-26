/** @format */

import { Action, CrosswordDispatchContext, crosswordStateReducer, initialStateFromInput } from "lib/crossword/state";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { Direction, PuzzleInput, RuntimeClue } from "~/lib/crossword/types";
import React from "react";
import styles from "~/lib/styles";
import SubBanner from "~/components/subbanner.client";
import Link from "next/link";
import CreditLink from "./credit.client";

type Props = {
	puzzleInput: PuzzleInput;
	showArchiveTeaser?: boolean;
	showSubscribePromo?: boolean;
};

export default function CrosswordGame({ puzzleInput, showArchiveTeaser = true, showSubscribePromo = true }: Props) {
	const initialState = useMemo(() => {
		return initialStateFromInput(puzzleInput);
	}, [puzzleInput]);

	const [state, dispatch] = useReducer(crosswordStateReducer, initialState);
	const boardRef = useRef<HTMLDivElement>(null);
	const restoredStorageKeyRef = useRef<string | null>(null);
	const cellSize = 30;
	const hasMutatedRef = useRef(false);
	const storageKey = useMemo(() => `crosswordGameState:v4:${puzzleInput.date}`, [puzzleInput.date]);

	const date = useMemo(() => {
		return new Date(puzzleInput.date);
	}, [puzzleInput.date]);

	const won = useMemo(() => {
		return state.grid.every(c => c.every(cell => (cell.used ? cell.answer == cell.guess : true)));
	}, [state.grid]);

	useEffect(() => {
		if (won == true && !state.won) {
			dispatch({ type: "setWon", to: true });
		}
	}, [dispatch, state.won, won]);

	// Function to find the clue associated with the selected cell
	const selectedClue = useMemo(() => {
		const { row, col } = state.position;

		const clue =
			state.direction == "across"
				? state.clues.across.find(clue => row === clue.row && col >= clue.col && col < clue.col + clue.answer.length) ?? null
				: state.clues.down.find(clue => col === clue.col && row >= clue.row && row < clue.row + clue.answer.length) ?? null;

		return clue;
	}, [state.position, state.direction, state.clues]);

	useEffect(() => {
		if (hasMutatedRef.current) {
			const serializedState = JSON.stringify({
				grid: state.grid,
				seconds: state.seconds,
				position: state.position,
				direction: state.direction,
				autocheck: state.autocheck,
			});
			localStorage.setItem(storageKey, serializedState);
		}
	}, [state.autocheck, state.direction, state.grid, state.position, state.seconds, storageKey]);

	useEffect(() => {
		if (restoredStorageKeyRef.current === storageKey) return;
		restoredStorageKeyRef.current = storageKey;

		const savedState = localStorage.getItem(storageKey);
		if (savedState) {
			try {
				const parsedState = JSON.parse(savedState);
				dispatch({ type: "loadState", state: parsedState, puzzleInput });
			} catch {
				localStorage.removeItem(storageKey);
			}
		}
	}, [dispatch, puzzleInput, storageKey]);

	const focusBoard = useCallback(() => {
		boardRef.current?.focus();
	}, []);

	const dispatchWithTracking = useCallback(
		(action: Action) => {
			dispatch(action);
			hasMutatedRef.current = true;
		},
		[dispatch]
	);

	useEffect(() => {
		focusBoard();
	}, [focusBoard, storageKey]);

	useEffect(() => {
		const intervalId = setInterval(() => {
			if (!won) {
				dispatchWithTracking({ type: "tick" });
			}
		}, 1000);

		return () => clearInterval(intervalId);
	}, [dispatchWithTracking, won]);

	const focusClue = useCallback(
		(clue: RuntimeClue, direction: Direction) => {
			dispatchWithTracking({ type: "focusClue", row: clue.row, col: clue.col, direction });
			focusBoard();
		},
		[dispatchWithTracking, focusBoard]
	);

	const handleBoardKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>) => {
			const handledKeys = [" ", "Backspace", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
			const isLetter = e.key.length === 1 && /[a-z]/i.test(e.key);
			if (isLetter || handledKeys.includes(e.key)) {
				e.preventDefault();
			}
			dispatchWithTracking({ type: "keyDown", key: e.key });
		},
		[dispatchWithTracking]
	);

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
				<h1>{puzzleInput.title}</h1>
				<p style={{ fontFamily: styles.font.sans }}>
					By <CreditLink author={puzzleInput.author} /> on{" "}
					{date.toLocaleString("en-us", { timeZone: "America/New_York", dateStyle: "long" })}
				</p>
			</div>
			<MenuBar
				seconds={state.seconds}
				autocheck={state.autocheck}
				paused={state.paused}
				onReset={() => {
					dispatchWithTracking({ type: "resetGrid", puzzleInput: puzzleInput });
					focusBoard();
				}}
				onToggleAutocheck={() => {
					dispatchWithTracking({ type: "toggleAutocheck" });
					focusBoard();
				}}
				onTogglePaused={() => {
					dispatchWithTracking({ type: "togglePaused" });
					focusBoard();
				}}
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
					<div ref={boardRef} tabIndex={0} onKeyDown={handleBoardKeyDown} style={{ outline: "none" }} aria-label="Crossword grid">
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
												isSelected={rowIndex == state.position.row && colIndex == state.position.col}
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
													dispatchWithTracking({ type: "selectCell", row: rowIndex, col: colIndex });
													focusBoard();
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
						<CluesSectionMemo
							clues={state.clues.across}
							title="Across"
							direction="across"
							selectedClueNum={selectedClue?.num}
							selectedDirection={state.direction}
							onSelectClue={focusClue}
						/>
						<CluesSectionMemo
							clues={state.clues.down}
							title="Down"
							direction="down"
							selectedClueNum={selectedClue?.num}
							selectedDirection={state.direction}
							onSelectClue={focusClue}
						/>
					</div>
				</div>
			)}
			<br />
			{showArchiveTeaser ? (
				<Link href="/games/crossword">
					<p>Browse the latest puzzle and archive &#x21E8;</p>
				</Link>
			) : null}
			{showSubscribePromo ? <SubBanner title="Enjoyed the crossword? Consider subscribing." /> : null}
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
		<g
			onPointerDown={e => {
				e.preventDefault();
				onClick();
			}}
			style={{ cursor: "pointer" }}
		>
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

	onTogglePaused?: () => void;
	onReset?: () => void;
	onToggleAutocheck?: () => void;
};

// MenuBar component with toggle button for autocheck and reset button
function MenuBar({ seconds, paused, autocheck, onTogglePaused, onReset, onToggleAutocheck }: MenuBarProps) {
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
	direction: Direction;
	selectedClueNum?: string;
	selectedDirection: Direction;
	onSelectClue: (clue: RuntimeClue, direction: Direction) => void;
};

function CluesSection({ clues, title, direction, selectedClueNum, selectedDirection, onSelectClue }: CluesSectionProps): JSX.Element {
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
					margin-bottom: 6px;
					font-size: 1rem;
				}

				.clue-number {
					margin-right: 5px;
				}

				h2 {
					padding-bottom: 10px;
				}

				.clue-button {
					width: 100%;
					border: none;
					background: transparent;
					padding: 0.45rem 0.5rem;
					text-align: left;
					top: 0;
					transition: background 0.18s ease, color 0.18s ease;
				}

				.clue-button:hover {
					background: #eef4fb;
				}

				.clue-button.is-active {
					background: #dcecff;
				}

				.clue-button:focus-visible {
					outline: 2px solid rgb(94, 150, 229);
					outline-offset: 1px;
				}
			`}</style>
			<h2>{title}</h2>
			<ul>
				{clues.map((clue: RuntimeClue) => (
					<li key={clue.num}>
						<button
							type="button"
							className={`clue-button ${selectedDirection === direction && selectedClueNum === clue.num ? "is-active" : ""}`}
							onClick={() => onSelectClue(clue, direction)}
						>
							<span className="clue-number">{clue.num}</span> {clue.clue}
						</button>
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
