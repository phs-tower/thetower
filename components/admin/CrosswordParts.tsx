/** @format */

// The grid and the clue dialog, shared by the console's solo builder
// (/admin/crossword) and the shareable room (/crossword/build/[token]).
// The room adds other people's cursors; the console passes none.

import { BLACK, clueKey, type Dir, type Entry, type Grid } from "~/lib/console/crossword-grid";

export interface PeerCursor {
	authorId: string;
	name: string;
	color: string;
	r: number;
	c: number;
}

export function GridEditor({
	grid,
	numbers,
	mode,
	selected,
	highlight,
	peers = [],
	onCellClick,
	onKeyDown,
	gridRef,
}: {
	grid: Grid;
	numbers: Map<string, number>;
	mode: "blocks" | "letters";
	selected: { r: number; c: number } | null;
	highlight: Set<string>;
	peers?: PeerCursor[];
	onCellClick: (r: number, c: number) => void;
	onKeyDown: (e: React.KeyboardEvent) => void;
	gridRef: React.RefObject<HTMLDivElement>;
}) {
	const cols = grid[0]?.length ?? 0;
	const peerAt = new Map<string, PeerCursor>();
	// Last peer wins a shared square; the ring only has to show that somebody
	// else is there, not every one of them.
	for (const peer of peers) peerAt.set(`${peer.r},${peer.c}`, peer);

	return (
		<div
			className="ta-xw-grid"
			ref={gridRef}
			tabIndex={0}
			onKeyDown={onKeyDown}
			style={{ gridTemplateColumns: `repeat(${cols}, var(--xw-cell))` }}
			aria-label={mode === "blocks" ? "Click squares to make them black" : "Type letters into the grid"}
		>
			{grid.map((rowCells, r) =>
				rowCells.map((cell, c) => {
					const black = cell === BLACK;
					const isSel = selected?.r === r && selected?.c === c;
					const inWord = highlight.has(`${r},${c}`);
					const number = numbers.get(`${r},${c}`);
					const peer = peerAt.get(`${r},${c}`);
					return (
						<div
							key={`${r},${c}`}
							className={`ta-xw-cell${black ? " black" : ""}${isSel ? " selected" : ""}${inWord && !isSel ? " in-word" : ""}${
								peer ? " peer" : ""
							}`}
							style={peer ? ({ "--peer": peer.color } as React.CSSProperties) : undefined}
							title={peer ? `${peer.name} is here` : undefined}
							onMouseDown={e => {
								e.preventDefault();
								onCellClick(r, c);
							}}
						>
							{!black && number !== undefined && <span className="ta-xw-num">{number}</span>}
							{!black && <span className="ta-xw-letter">{cell}</span>}
						</div>
					);
				})
			)}
		</div>
	);
}

export function ClueDialog({
	entries,
	clues,
	onChange,
	onClose,
	onSave,
	busy,
	error,
	saveLabel = "Save crossword",
	canSave = true,
	footerNote,
}: {
	entries: Entry[];
	clues: Record<string, string>;
	onChange: (key: string, value: string) => void;
	onClose: () => void;
	onSave?: () => void;
	busy: boolean;
	error: string | null;
	saveLabel?: string;
	canSave?: boolean;
	footerNote?: string;
}) {
	const written = entries.filter(e => (clues[clueKey(e.dir, e.row, e.col)] ?? "").trim()).length;

	const section = (dir: Dir) => {
		const list = entries.filter(e => e.dir === dir);
		return (
			<div className="ta-xw-cluecol">
				<h3>{dir === "across" ? "Across" : "Down"}</h3>
				{list.length === 0 && <p className="ta-muted ta-small">No {dir} entries.</p>}
				{list.map(e => {
					const key = clueKey(e.dir, e.row, e.col);
					return (
						<label key={key} className="ta-xw-clue">
							<span className="ta-xw-clue-head">
								<b>{e.number}</b> <code>{e.answer}</code>
							</span>
							<input
								type="text"
								value={clues[key] ?? ""}
								placeholder={`Clue for ${e.answer}`}
								onChange={ev => onChange(key, ev.target.value)}
							/>
						</label>
					);
				})}
			</div>
		);
	};

	return (
		<div className="ta-xw-scrim" onMouseDown={onClose}>
			<div className="ta-xw-dialog" onMouseDown={e => e.stopPropagation()}>
				<div className="ta-row ta-spread">
					<h2>Write the clues</h2>
					<span className="ta-badge">
						{written} of {entries.length} written
					</span>
				</div>
				<div className="ta-xw-clues">
					{section("across")}
					{section("down")}
				</div>
				{error && <p className="ta-error">{error}</p>}
				{footerNote && <p className="ta-muted ta-small">{footerNote}</p>}
				<div className="ta-row">
					{canSave && onSave && (
						<button className="ta-btn ta-btn-primary" onClick={onSave} disabled={busy}>
							{busy ? "Saving…" : saveLabel}
						</button>
					)}
					<button className="ta-btn" onClick={onClose} disabled={busy}>
						Back to the grid
					</button>
				</div>
			</div>
		</div>
	);
}
