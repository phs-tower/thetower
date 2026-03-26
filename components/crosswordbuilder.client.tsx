/** @format */

import { ChangeEvent, Dispatch, KeyboardEvent, SetStateAction, useCallback, useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import type { Direction, PuzzleInput } from "~/lib/crossword/types";

export type CrosswordEditorCell = {
	blocked: boolean;
	letter: string;
};

export type CrosswordDraft = {
	title: string;
	author: string;
	date: string;
	rows: number;
	cols: number;
	grid: CrosswordEditorCell[][];
	clueTexts: Record<string, string>;
	selectedCell: { row: number; col: number } | null;
};

type CrosswordEntry = {
	key: string;
	num: string;
	direction: Direction;
	row: number;
	col: number;
	answer: string;
	clue: string;
};

type Props = {
	value: CrosswordDraft;
	onChange: Dispatch<SetStateAction<CrosswordDraft>>;
};

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}

function normalizeLetter(value: string) {
	const trimmed = value.trim().toUpperCase();
	return /^[A-Z]$/.test(trimmed) ? trimmed : "";
}

function getCellSizeRem(rows: number, cols: number) {
	const maxDimension = Math.max(rows, cols);

	if (maxDimension <= 5) return 5.2;
	if (maxDimension <= 7) return 4.8;
	if (maxDimension <= 9) return 4.3;
	if (maxDimension <= 11) return 3.8;
	if (maxDimension <= 13) return 3.4;
	if (maxDimension <= 15) return 3;
	if (maxDimension <= 17) return 2.7;
	if (maxDimension <= 19) return 2.35;
	return 2.05;
}

function createGrid(rows: number, cols: number, previous?: CrosswordEditorCell[][]) {
	return Array.from({ length: rows }, (_, row) =>
		Array.from({ length: cols }, (_, col) => {
			const existing = previous?.[row]?.[col];
			return {
				blocked: existing?.blocked ?? false,
				letter: existing?.blocked ? "" : existing?.letter ?? "",
			};
		})
	);
}

export function createEmptyCrosswordDraft(rows = 15, cols = 15): CrosswordDraft {
	return {
		title: "",
		author: "",
		date: new Date().toISOString().slice(0, 10),
		rows,
		cols,
		grid: createGrid(rows, cols),
		clueTexts: {},
		selectedCell: { row: 0, col: 0 },
	};
}

export function normalizeCrosswordDraft(raw: unknown): CrosswordDraft {
	const fallback = createEmptyCrosswordDraft();
	if (!raw || typeof raw !== "object") return fallback;

	const candidate = raw as Partial<CrosswordDraft>;
	const rows = clamp(Number(candidate.rows) || fallback.rows, 3, 25);
	const cols = clamp(Number(candidate.cols) || fallback.cols, 3, 25);
	const nextGrid = createGrid(rows, cols, Array.isArray(candidate.grid) ? (candidate.grid as CrosswordEditorCell[][]) : undefined).map(row =>
		row.map(cell => ({
			blocked: Boolean(cell.blocked),
			letter: cell.blocked ? "" : normalizeLetter(cell.letter),
		}))
	);

	const selectedCell =
		candidate.selectedCell &&
		typeof candidate.selectedCell.row === "number" &&
		typeof candidate.selectedCell.col === "number" &&
		candidate.selectedCell.row >= 0 &&
		candidate.selectedCell.row < rows &&
		candidate.selectedCell.col >= 0 &&
		candidate.selectedCell.col < cols
			? candidate.selectedCell
			: { row: 0, col: 0 };

	return {
		title: typeof candidate.title === "string" ? candidate.title : "",
		author: typeof candidate.author === "string" ? candidate.author : "",
		date: typeof candidate.date === "string" && candidate.date ? candidate.date : fallback.date,
		rows,
		cols,
		grid: nextGrid,
		clueTexts: candidate.clueTexts && typeof candidate.clueTexts === "object" ? (candidate.clueTexts as Record<string, string>) : {},
		selectedCell,
	};
}

function isBlack(cell?: CrosswordEditorCell) {
	return !cell || cell.blocked;
}

function getCellNumberMap(grid: CrosswordEditorCell[][]) {
	const map = new Map<string, string>();
	let currentNumber = 1;

	for (let row = 0; row < grid.length; row++) {
		for (let col = 0; col < grid[row].length; col++) {
			const cell = grid[row][col];
			if (cell.blocked) continue;

			const startsAcross = isBlack(grid[row][col - 1]) && !isBlack(grid[row][col + 1]);
			const startsDown = isBlack(grid[row - 1]?.[col]) && !isBlack(grid[row + 1]?.[col]);

			if (startsAcross || startsDown) {
				map.set(`${row}:${col}`, String(currentNumber));
				currentNumber++;
			}
		}
	}

	return map;
}

function getEntries(grid: CrosswordEditorCell[][], clueTexts: Record<string, string>): CrosswordEntry[] {
	const entries: CrosswordEntry[] = [];
	const numberMap = getCellNumberMap(grid);
	const rows = grid.length;
	const cols = grid[0]?.length ?? 0;

	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const cell = grid[row][col];
			if (cell.blocked) continue;

			const number = numberMap.get(`${row}:${col}`);
			if (!number) continue;

			const startsAcross = isBlack(grid[row][col - 1]) && !isBlack(grid[row][col + 1]);
			if (startsAcross) {
				let answer = "";
				let cursor = col;
				while (cursor < cols && !grid[row][cursor].blocked) {
					answer += grid[row][cursor].letter;
					cursor++;
				}
				entries.push({
					key: `across-${row}-${col}`,
					num: number,
					direction: "across",
					row,
					col,
					answer,
					clue: clueTexts[`across-${row}-${col}`] ?? "",
				});
			}

			const startsDown = isBlack(grid[row - 1]?.[col]) && !isBlack(grid[row + 1]?.[col]);
			if (startsDown) {
				let answer = "";
				let cursor = row;
				while (cursor < rows && !grid[cursor][col].blocked) {
					answer += grid[cursor][col].letter;
					cursor++;
				}
				entries.push({
					key: `down-${row}-${col}`,
					num: number,
					direction: "down",
					row,
					col,
					answer,
					clue: clueTexts[`down-${row}-${col}`] ?? "",
				});
			}
		}
	}

	return entries;
}

export function hasCrosswordDraftContent(draft: CrosswordDraft) {
	return Boolean(
		draft.title.trim() ||
			draft.author.trim() ||
			Object.values(draft.clueTexts).some(value => value.trim()) ||
			draft.grid.some(row => row.some(cell => cell.blocked || Boolean(cell.letter)))
	);
}

export function serializeCrosswordDraft(
	draft: CrosswordDraft
): { ok: true; value: { title: string; author: string; date: string; clues: PuzzleInput["clues"] } } | { ok: false; error: string } {
	const title = draft.title.trim();
	const author = draft.author.trim();
	if (!title) return { ok: false, error: "Upload failed: Crossword title is required." };
	if (!author) return { ok: false, error: "Upload failed: Crossword author is required." };
	if (!draft.date) return { ok: false, error: "Upload failed: Crossword date is required." };

	const entries = getEntries(draft.grid, draft.clueTexts);
	if (entries.length === 0) return { ok: false, error: "Upload failed: Build at least one crossword entry first." };

	const clues: PuzzleInput["clues"] = { across: {}, down: {} };

	for (const entry of entries) {
		if (!entry.answer) {
			return { ok: false, error: `Upload failed: Fill every letter for ${entry.num} ${entry.direction}.` };
		}
		if (!/^[A-Z]+$/.test(entry.answer)) {
			return { ok: false, error: `Upload failed: ${entry.num} ${entry.direction} contains invalid letters.` };
		}
		if (!entry.clue.trim()) {
			return { ok: false, error: `Upload failed: Add clue text for ${entry.num} ${entry.direction}.` };
		}

		clues[entry.direction][entry.num] = {
			clue: entry.clue.trim(),
			answer: entry.answer,
			row: entry.row,
			col: entry.col,
		};
	}

	return {
		ok: true,
		value: {
			title,
			author,
			date: draft.date,
			clues,
		},
	};
}

export default function CrosswordBuilder({ value, onChange }: Props) {
	const entries = useMemo(() => getEntries(value.grid, value.clueTexts), [value.grid, value.clueTexts]);
	const numberMap = useMemo(() => getCellNumberMap(value.grid), [value.grid]);
	const boardCellSize = useMemo(() => getCellSizeRem(value.rows, value.cols), [value.cols, value.rows]);
	const mobileBoardCellSize = useMemo(() => Math.max(1.9, boardCellSize * 0.74), [boardCellSize]);
	const boardRef = useRef<HTMLDivElement>(null);

	const updateDraft = useCallback(
		(updater: (draft: CrosswordDraft) => CrosswordDraft) => {
			onChange(updater);
		},
		[onChange]
	);

	const focusBoard = useCallback(() => {
		boardRef.current?.focus();
	}, []);

	function shouldIgnoreGlobalKey(target: EventTarget | null) {
		if (!(target instanceof HTMLElement)) return false;
		const tagName = target.tagName.toLowerCase();
		return tagName === "input" || tagName === "textarea" || target.isContentEditable;
	}

	useEffect(() => {
		focusBoard();
	}, [focusBoard]);

	function resizeGrid(nextRows: number, nextCols: number) {
		updateDraft(draft => {
			const rows = clamp(nextRows, 3, 25);
			const cols = clamp(nextCols, 3, 25);
			const selectedCell = draft.selectedCell
				? {
						row: clamp(draft.selectedCell.row, 0, rows - 1),
						col: clamp(draft.selectedCell.col, 0, cols - 1),
				  }
				: { row: 0, col: 0 };

			return {
				...draft,
				rows,
				cols,
				grid: createGrid(rows, cols, draft.grid),
				selectedCell,
			};
		});
	}

	const selectCell = useCallback(
		(row: number, col: number) => {
			updateDraft(draft => ({
				...draft,
				selectedCell: { row, col },
			}));
			focusBoard();
		},
		[focusBoard, updateDraft]
	);

	const updateSelectedCell = useCallback(
		(updater: (cell: CrosswordEditorCell) => CrosswordEditorCell) => {
			if (!value.selectedCell) return;

			const { row, col } = value.selectedCell;
			updateDraft(draft => {
				const grid = draft.grid.map((draftRow, rowIndex) =>
					draftRow.map((cell, colIndex) => {
						if (rowIndex !== row || colIndex !== col) return cell;
						return updater(cell);
					})
				);

				return { ...draft, grid };
			});
		},
		[updateDraft, value.selectedCell]
	);

	const toggleCellBlocked = useCallback(
		(row: number, col: number) => {
			updateDraft(draft => ({
				...draft,
				selectedCell: { row, col },
				grid: draft.grid.map((draftRow, rowIndex) =>
					draftRow.map((cell, colIndex) => {
						if (rowIndex !== row || colIndex !== col) return cell;
						return {
							blocked: !cell.blocked,
							letter: cell.blocked ? cell.letter : "",
						};
					})
				),
			}));
			focusBoard();
		},
		[focusBoard, updateDraft]
	);

	const toggleSelectedBlocked = useCallback(() => {
		updateSelectedCell(cell => ({
			blocked: !cell.blocked,
			letter: !cell.blocked ? "" : cell.letter,
		}));
	}, [updateSelectedCell]);

	const clearSelectedCell = useCallback(() => {
		updateSelectedCell(cell => ({
			...cell,
			blocked: false,
			letter: "",
		}));
	}, [updateSelectedCell]);

	const moveSelection = useCallback(
		(deltaRow: number, deltaCol: number) => {
			if (!value.selectedCell) return;
			selectCell(clamp(value.selectedCell.row + deltaRow, 0, value.rows - 1), clamp(value.selectedCell.col + deltaCol, 0, value.cols - 1));
		},
		[selectCell, value.cols, value.rows, value.selectedCell]
	);

	function handleGridKeyDown(e: KeyboardEvent<HTMLDivElement>) {
		if (!value.selectedCell) return;

		if (e.key === "ArrowUp") {
			e.preventDefault();
			moveSelection(-1, 0);
			return;
		}
		if (e.key === "ArrowDown") {
			e.preventDefault();
			moveSelection(1, 0);
			return;
		}
		if (e.key === "ArrowLeft") {
			e.preventDefault();
			moveSelection(0, -1);
			return;
		}
		if (e.key === "ArrowRight") {
			e.preventDefault();
			moveSelection(0, 1);
			return;
		}
		if (e.key === "Backspace" || e.key === "Delete") {
			e.preventDefault();
			clearSelectedCell();
			return;
		}
		if (e.key === "#") {
			e.preventDefault();
			toggleSelectedBlocked();
			return;
		}
		if (/^[a-z]$/i.test(e.key)) {
			e.preventDefault();
			const letter = e.key.toUpperCase();
			updateSelectedCell(cell => ({
				blocked: false,
				letter,
			}));
			moveSelection(0, 1);
		}
	}

	function updateClue(entryKey: string, e: ChangeEvent<HTMLInputElement>) {
		const nextValue = e.target.value;
		updateDraft(draft => ({
			...draft,
			clueTexts: {
				...draft.clueTexts,
				[entryKey]: nextValue,
			},
		}));
	}

	const boardStyle = useMemo(
		() =>
			({
				"--cell-size": `${boardCellSize}rem`,
				"--cell-size-mobile": `${mobileBoardCellSize}rem`,
				gridTemplateColumns: `repeat(${value.cols}, var(--cell-size, ${boardCellSize}rem))`,
			} as CSSProperties),
		[boardCellSize, mobileBoardCellSize, value.cols]
	);

	useEffect(() => {
		function handleWindowKeyDown(e: globalThis.KeyboardEvent) {
			if (!value.selectedCell) return;
			if (shouldIgnoreGlobalKey(e.target)) return;

			if (e.key === "ArrowUp") {
				e.preventDefault();
				moveSelection(-1, 0);
				return;
			}
			if (e.key === "ArrowDown") {
				e.preventDefault();
				moveSelection(1, 0);
				return;
			}
			if (e.key === "ArrowLeft") {
				e.preventDefault();
				moveSelection(0, -1);
				return;
			}
			if (e.key === "ArrowRight") {
				e.preventDefault();
				moveSelection(0, 1);
				return;
			}
			if (e.key === "Backspace" || e.key === "Delete") {
				e.preventDefault();
				clearSelectedCell();
				return;
			}
			if (e.key === "#") {
				e.preventDefault();
				toggleSelectedBlocked();
				return;
			}
			if (/^[a-z]$/i.test(e.key)) {
				e.preventDefault();
				const letter = e.key.toUpperCase();
				updateSelectedCell(cell => ({
					blocked: false,
					letter,
				}));
				moveSelection(0, 1);
			}
		}

		window.addEventListener("keydown", handleWindowKeyDown);
		return () => window.removeEventListener("keydown", handleWindowKeyDown);
	}, [clearSelectedCell, moveSelection, toggleSelectedBlocked, updateSelectedCell, value.selectedCell]);

	return (
		<div className="crossword-builder">
			<style jsx>{`
				.crossword-builder {
					display: grid;
					gap: 1.25rem;
				}

				.editor-layout {
					display: grid;
					gap: 1.35rem;
					align-items: start;
				}

				.top-controls {
					display: flex;
					flex-wrap: wrap;
					gap: 1rem;
					align-items: end;
				}

				.field {
					display: flex;
					flex-direction: column;
					gap: 0.35rem;
				}

				.field input {
					min-width: 11rem;
				}

				.grid-controls {
					display: flex;
					flex-wrap: wrap;
					gap: 0.75rem;
					align-items: center;
				}

				.grid-controls button {
					top: 0;
				}

				.board-shell {
					border: 1px solid #d8d8d8;
					padding: 1.15rem;
					background: #fcfcfc;
					width: fit-content;
					max-width: 100%;
				}

				.board-toolbar {
					display: flex;
					flex-wrap: wrap;
					gap: 0.6rem;
					align-items: center;
					margin-bottom: 0.85rem;
				}

				.board-toolbar p {
					margin: 0;
					color: #5f5f5f;
				}

				.board-wrap {
					overflow: auto;
					padding-bottom: 0.25rem;
				}

				.board {
					display: grid;
					gap: 2px;
					width: fit-content;
					outline: none;
				}

				.cell {
					position: relative;
					width: var(--cell-size);
					height: var(--cell-size);
					border: 1px solid #9b9b9b;
					background: white;
					padding: 0;
					top: 0;
					color: black;
					font-family: monospace;
					font-size: 1.95rem;
					font-weight: 700;
				}

				.cell.blocked {
					background: #111;
					border-color: #111;
				}

				.cell.selected {
					outline: 2px solid #5e96e5;
					outline-offset: 1px;
				}

				.cell-number {
					position: absolute;
					top: 3px;
					left: 4px;
					font-size: 0.76rem;
					font-weight: 500;
				}

				.cell-letter {
					display: inline-flex;
					align-items: center;
					justify-content: center;
					width: 100%;
					height: 100%;
					color: #111;
					opacity: 1;
				}

				.clues-grid {
					display: grid;
					grid-template-columns: repeat(2, minmax(0, 1fr));
					gap: 1rem;
					width: 100%;
				}

				.clue-group {
					border: 1px solid #d8d8d8;
					padding: 0.9rem;
					background: white;
				}

				.clue-list {
					display: flex;
					flex-direction: column;
					gap: 0.7rem;
				}

				.clue-row {
					display: grid;
					grid-template-columns: 4rem 1fr;
					gap: 0.7rem;
					align-items: start;
				}

				.clue-row label {
					color: #555;
					font-size: 0.9rem;
					padding-top: 0.45rem;
				}

				.meta-line {
					font-size: 0.82rem;
					color: #6d6d6d;
				}

				@media (max-width: 900px) {
					.clues-grid {
						grid-template-columns: 1fr;
					}

					.board {
						--cell-size: var(--cell-size-mobile, 2.95rem);
					}

					.cell {
						font-size: 1.3rem;
					}
				}
			`}</style>
			<div className="top-controls">
				<label className="field">
					<strong>Crossword Title</strong>
					<input value={value.title} onChange={e => updateDraft(draft => ({ ...draft, title: e.target.value }))} />
				</label>
				<label className="field">
					<strong>Crossword Author</strong>
					<input value={value.author} onChange={e => updateDraft(draft => ({ ...draft, author: e.target.value }))} />
				</label>
				<label className="field">
					<strong>Crossword Date</strong>
					<input type="date" value={value.date} onChange={e => updateDraft(draft => ({ ...draft, date: e.target.value }))} />
				</label>
				<div className="grid-controls">
					<label className="field">
						<strong>Rows</strong>
						<input type="number" min={3} max={25} value={value.rows} onChange={e => resizeGrid(Number(e.target.value), value.cols)} />
					</label>
					<label className="field">
						<strong>Cols</strong>
						<input type="number" min={3} max={25} value={value.cols} onChange={e => resizeGrid(value.rows, Number(e.target.value))} />
					</label>
				</div>
			</div>

			<div className="editor-layout">
				<div className="board-shell">
					<div className="board-toolbar">
						<button type="button" onClick={toggleSelectedBlocked}>
							Toggle Black Square
						</button>
						<button type="button" onClick={clearSelectedCell}>
							Clear Cell
						</button>
						<p>Click any square and start typing. Use arrow keys to move, or `#` to make a black square.</p>
					</div>
					<div className="board-wrap">
						<div ref={boardRef} className="board" tabIndex={0} onKeyDown={handleGridKeyDown} style={boardStyle}>
							{value.grid.map((row, rowIndex) =>
								row.map((cell, colIndex) => {
									const number = numberMap.get(`${rowIndex}:${colIndex}`);
									const isSelected = value.selectedCell?.row === rowIndex && value.selectedCell?.col === colIndex;

									return (
										<button
											type="button"
											key={`${rowIndex}-${colIndex}`}
											className={`cell ${cell.blocked ? "blocked" : ""} ${isSelected ? "selected" : ""}`}
											onPointerDown={e => {
												e.preventDefault();
												selectCell(rowIndex, colIndex);
											}}
											onDoubleClick={() => {
												toggleCellBlocked(rowIndex, colIndex);
											}}
										>
											{number && !cell.blocked ? <span className="cell-number">{number}</span> : null}
											{!cell.blocked ? <span className="cell-letter">{cell.letter}</span> : null}
										</button>
									);
								})
							)}
						</div>
					</div>
				</div>

				<div className="clues-grid">
					{(["across", "down"] as Direction[]).map(direction => (
						<div key={direction} className="clue-group">
							<h3>{direction === "across" ? "Across" : "Down"}</h3>
							<div className="clue-list">
								{entries
									.filter(entry => entry.direction === direction)
									.map(entry => (
										<div key={entry.key} className="clue-row">
											<label htmlFor={entry.key}>
												<strong>{entry.num}</strong>
												<div className="meta-line">{entry.answer.length} letters</div>
											</label>
											<div>
												<input
													id={entry.key}
													value={entry.clue}
													onChange={e => updateClue(entry.key, e)}
													placeholder={`${entry.answer || "(fill answer)"} clue`}
												/>
												<div className="meta-line">{entry.answer || "Fill the answer in the grid first."}</div>
											</div>
										</div>
									))}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
