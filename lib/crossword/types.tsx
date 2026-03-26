/** @format */

export type UsedCellData = { used: true; num?: string; guess?: string; answer: string };
export type UnusedCellData = { used: false };

export type CellData = UsedCellData | UnusedCellData;
export type GridData = CellData[][];

export type Direction = "across" | "down";

export type Clue = { clue: string; answer: string; row: number; col: number };
export type RuntimeClue = Clue & { num: string };

export type PuzzleInput = {
	title: string;
	date: string;
	author: string;
	clues: Record<Direction, Record<string, Clue>>;
};

export type SavedPuzzleState = {
	grid: GridData;
	seconds: number;
	position?: Pos;
	direction?: Direction;
	autocheck?: boolean;
};

// These two arrays will be sorted by num so that we can display the two columns easily
export type Clues = { across: RuntimeClue[]; down: RuntimeClue[] };

export type Pos = { row: number; col: number };

export type GameState = {
	rows: number;
	cols: number;
	grid: GridData;
	clues: Clues;

	position: Pos;
	direction: Direction;
	seconds: number;

	autocheck: boolean;
	paused: boolean;
	won: boolean;
};
