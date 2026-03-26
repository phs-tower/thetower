/** @format */

import { createContext, useContext, type Dispatch } from "react";
import { Clues, Direction, GameState, GridData, PuzzleInput, SavedPuzzleState } from "./types";

type Dispatcher = Dispatch<Action>;

export function initialStateFromInput(input: PuzzleInput, existingGrid?: GridData): GameState {
	let max = 0;

	for (const directionKey in input.clues) {
		const direction = directionKey as Direction;
		for (const num in input.clues[direction]) {
			const clue = input.clues[direction][num];
			if (direction === "across") {
				max = Math.max(max, clue.row);
				max = Math.max(max, clue.col + clue.answer.length);
			} else if (direction === "down") {
				max = Math.max(max, clue.row + clue.answer.length);
				max = Math.max(max, clue.col);
			}
		}
	}

	// Initialize grid with unused cells
	const grid: GridData = Array.from({ length: max }, () => Array.from({ length: max }, () => ({ used: false })));

	// Populate grid with used cells and set numbers for starting positions
	const clues: Clues = { across: [], down: [] };

	for (const directionKey in input.clues) {
		const direction = directionKey as Direction;
		for (const num in input.clues[direction]) {
			const actualNum = num as unknown as string;
			const clue = input.clues[direction][num];
			const runtimeClue = { ...clue, num: actualNum };
			clues[direction].push(runtimeClue);

			for (let i = 0; i < clue.answer.length; i++) {
				const row = clue.row + (direction === "down" ? i : 0);
				const col = clue.col + (direction === "across" ? i : 0);
				const existing = grid[row][col];
				grid[row][col] = { used: true, answer: clue.answer[i], num: i == 0 ? actualNum : existing.used ? existing.num : undefined };
			}
		}
	}

	// Sort the clues by their numbers
	for (const direction in clues) {
		clues[direction as Direction].sort((a, b) => Number(a.num) - Number(b.num));
	}

	const firstClue = clues.across[0] ?? clues.down[0];
	const initialPosition = firstClue ? { row: firstClue.row, col: firstClue.col } : { row: 0, col: 0 };
	const initialDirection: Direction = clues.across[0] ? "across" : "down";

	// Set initial state
	return {
		rows: max,
		cols: max,
		grid: existingGrid ?? grid,
		clues,
		position: initialPosition,
		direction: initialDirection,
		seconds: 0,
		autocheck: false,
		paused: false,
		won: false,
	};
}

export type Action =
	| { type: "selectCell"; col: number; row: number }
	| { type: "focusClue"; col: number; row: number; direction: Direction }
	| { type: "keyDown"; key: string }
	| { type: "loadState"; state: SavedPuzzleState; puzzleInput: PuzzleInput }
	| { type: "tick" }
	| { type: "resetGrid"; puzzleInput: PuzzleInput }
	| { type: "toggleAutocheck" }
	| { type: "togglePaused" }
	| { type: "setWon"; to: boolean };

function isDirection(value: unknown): value is Direction {
	return value === "across" || value === "down";
}

function applyCrosswordAction(state: GameState, action: Action) {
	function moveRelative(rows: number, cols: number) {
		const newRow = state.position.row + rows;
		const newCol = state.position.col + cols;
		if (newRow >= 0 && newRow < state.rows && state.grid[newRow][state.position.col].used) {
			state.position.row = newRow;
		}
		if (newCol >= 0 && newCol < state.cols && state.grid[state.position.row][newCol].used) {
			state.position.col = newCol;
		}
	}

	function moveForward() {
		if (state.direction == "across") {
			moveRelative(0, 1);
		} else {
			moveRelative(1, 0);
		}
	}

	function moveBackward() {
		if (state.direction == "across") {
			moveRelative(0, -1);
		} else {
			moveRelative(-1, 0);
		}
	}

	switch (action.type) {
		case "selectCell": {
			if (state.position.col == action.col && state.position.row == action.row) {
				state.direction = state.direction == "across" ? "down" : "across";
			} else {
				state.position = { col: action.col, row: action.row };
			}
			return;
		}
		case "focusClue": {
			state.position = { col: action.col, row: action.row };
			state.direction = action.direction;
			return;
		}
		case "keyDown": {
			const cell = state.grid[state.position.row][state.position.col];
			const key = action.key;
			if (!cell.used) return;

			if (key.length === 1 && action.key.match(/[a-z]/i)) {
				cell.guess = action.key.toUpperCase();
				moveForward();
			} else if (key == " ") {
				cell.guess = undefined;
				moveForward();
			} else if (key == "Backspace") {
				if (cell.guess == undefined) {
					moveBackward();
					const newCell = state.grid[state.position.row][state.position.col];
					if (newCell.used) {
						newCell.guess = undefined;
					}
				} else {
					cell.guess = undefined;
				}
			} else if (key == "ArrowLeft") {
				if (state.direction == "across") {
					moveRelative(0, -1);
				} else {
					state.direction = "across";
				}
			} else if (key == "ArrowRight") {
				if (state.direction == "across") {
					moveRelative(0, 1);
				} else {
					state.direction = "across";
				}
			} else if (key == "ArrowUp") {
				if (state.direction == "down") {
					moveRelative(-1, 0);
				} else {
					state.direction = "down";
				}
			} else if (key == "ArrowDown") {
				if (state.direction == "down") {
					moveRelative(1, 0);
				} else {
					state.direction = "down";
				}
			}

			return;
		}
		case "loadState": {
			const restored = initialStateFromInput(action.puzzleInput);
			const savedGrid = action.state.grid;

			if (Array.isArray(savedGrid)) {
				for (let row = 0; row < restored.rows; row++) {
					for (let col = 0; col < restored.cols; col++) {
						const restoredCell = restored.grid[row]?.[col];
						const savedCell = savedGrid[row]?.[col];

						if (!restoredCell?.used || !savedCell || !savedCell.used) continue;
						if (typeof savedCell.guess === "string" && savedCell.guess.length === 1) {
							restoredCell.guess = savedCell.guess.toUpperCase();
						}
					}
				}
			}

			state.grid = restored.grid;
			state.clues = restored.clues;
			state.rows = restored.rows;
			state.cols = restored.cols;
			state.seconds = Number.isFinite(action.state.seconds) && action.state.seconds >= 0 ? action.state.seconds : 0;
			state.autocheck = Boolean(action.state.autocheck);
			state.paused = false;
			state.won = false;
			state.direction = isDirection(action.state.direction) ? action.state.direction : restored.direction;

			const savedPosition = action.state.position;
			if (
				savedPosition &&
				Number.isInteger(savedPosition.row) &&
				Number.isInteger(savedPosition.col) &&
				savedPosition.row >= 0 &&
				savedPosition.row < restored.rows &&
				savedPosition.col >= 0 &&
				savedPosition.col < restored.cols &&
				restored.grid[savedPosition.row][savedPosition.col].used
			) {
				state.position = savedPosition;
			} else {
				state.position = restored.position;
			}
			return;
		}
		case "tick": {
			if (state.paused) return;
			state.seconds++;
			return;
		}
		case "resetGrid": {
			const resetState = initialStateFromInput(action.puzzleInput);
			state.grid = resetState.grid;
			state.clues = resetState.clues;
			state.rows = resetState.rows;
			state.cols = resetState.cols;
			state.position = resetState.position;
			state.direction = resetState.direction;
			state.seconds = 0;
			state.paused = false;
			state.won = false;
			return;
		}
		case "toggleAutocheck": {
			state.autocheck = !state.autocheck;
			return;
		}
		case "togglePaused": {
			state.paused = !state.paused;
			return;
		}
		case "setWon": {
			state.won = action.to;
			return;
		}
	}
}

export function crosswordStateReducer(state: GameState, action: Action) {
	const nextState = structuredClone(state) as GameState;
	applyCrosswordAction(nextState, action);
	return nextState;
}

export const CrosswordDispatchContext = createContext<Dispatcher>(_ => {});

export function useDispatchContext(): Dispatcher {
	return useContext(CrosswordDispatchContext);
}
