/** @format */

import { useCallback, useEffect, useRef, useState } from "react";
import AdminShell, { useAdmin } from "~/components/admin/AdminShell";

// Feeds the app's Outreach → "Surveys & Forms" section (public.form). The app
// and site list ACTIVE forms ordered by sort_order.

interface FormRow {
	id: number;
	title: string;
	description: string | null;
	url: string;
	active: boolean;
	sort_order: number;
}

function FormsManager() {
	const { supabase } = useAdmin();
	const [forms, setForms] = useState<FormRow[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [orderDirty, setOrderDirty] = useState(false);
	const [draft, setDraft] = useState({ title: "", description: "", url: "" });
	const dragIx = useRef<number | null>(null);

	const load = useCallback(async () => {
		const { data, error: err } = await supabase
			.from("form")
			.select("id, title, description, url, active, sort_order")
			.order("sort_order")
			.order("id");
		if (err) {
			setError(err.message);
			return;
		}
		setForms((data ?? []) as FormRow[]);
		setOrderDirty(false);
	}, [supabase]);

	useEffect(() => {
		void load();
	}, [load]);

	const update = async (id: number, patch: Partial<FormRow>) => {
		setError(null);
		const { error: err } = await supabase.from("form").update(patch).eq("id", id);
		if (err) {
			setError(err.message);
			await load();
			return;
		}
		setForms(prev => prev.map(f => (f.id === id ? { ...f, ...patch } : f)));
	};

	const add = async () => {
		setError(null);
		if (!draft.title.trim() || !draft.url.trim()) {
			setError("Title and URL are required.");
			return;
		}
		try {
			// eslint-disable-next-line no-new
			new URL(draft.url.trim());
		} catch {
			setError("That URL doesn't look valid — include https://");
			return;
		}
		const maxOrder = forms.reduce((max, f) => Math.max(max, f.sort_order), 0);
		const { error: err } = await supabase.from("form").insert({
			title: draft.title.trim(),
			description: draft.description.trim() || null,
			url: draft.url.trim(),
			sort_order: maxOrder + 10,
		});
		if (err) {
			setError(err.message);
			return;
		}
		setDraft({ title: "", description: "", url: "" });
		await load();
	};

	const remove = async (f: FormRow) => {
		if (!window.confirm(`Delete "${f.title}"? (Deactivating hides it from the app without deleting.)`)) return;
		const { error: err } = await supabase.from("form").delete().eq("id", f.id);
		if (err) {
			setError(err.message);
			return;
		}
		await load();
	};

	const saveOrder = async () => {
		setError(null);
		for (let i = 0; i < forms.length; i++) {
			const target = (i + 1) * 10;
			if (forms[i].sort_order !== target) {
				const { error: err } = await supabase.from("form").update({ sort_order: target }).eq("id", forms[i].id);
				if (err) {
					setError(err.message);
					await load();
					return;
				}
			}
		}
		await load();
	};

	const onDrop = (targetIx: number) => {
		const from = dragIx.current;
		dragIx.current = null;
		if (from === null || from === targetIx) return;
		setForms(prev => {
			const next = [...prev];
			const [item] = next.splice(from, 1);
			next.splice(targetIx, 0, item);
			return next;
		});
		setOrderDirty(true);
	};

	return (
		<div className="ta-stack">
			<p className="ta-muted ta-small" style={{ margin: 0 }}>
				The app lists <b>active</b> forms in this order. Drag rows to reorder, then save the order.
			</p>
			{error && <p className="ta-error">{error}</p>}
			{orderDirty && (
				<div className="ta-row">
					<button className="ta-btn ta-btn-primary" onClick={() => void saveOrder()}>
						Save new order
					</button>
					<button className="ta-btn" onClick={() => void load()}>
						Discard
					</button>
				</div>
			)}
			<div className="ta-table-wrap">
				<table className="ta-table">
					<thead>
						<tr>
							<th style={{ width: 30 }} />
							<th style={{ width: 220 }}>Title</th>
							<th>Description</th>
							<th style={{ width: 260 }}>URL</th>
							<th style={{ width: 180 }}>Status</th>
						</tr>
					</thead>
					<tbody>
						{forms.map((f, ix) => (
							<tr
								key={f.id}
								draggable
								onDragStart={() => (dragIx.current = ix)}
								onDragOver={e => e.preventDefault()}
								onDrop={() => onDrop(ix)}
								style={f.active ? undefined : { opacity: 0.55 }}
							>
								<td className="ta-drag-handle">⠿</td>
								<td>
									<input
										type="text"
										defaultValue={f.title}
										onBlur={e => e.target.value !== f.title && void update(f.id, { title: e.target.value })}
									/>
								</td>
								<td>
									<input
										type="text"
										defaultValue={f.description ?? ""}
										placeholder="—"
										onBlur={e =>
											(e.target.value || null) !== f.description && void update(f.id, { description: e.target.value || null })
										}
									/>
								</td>
								<td>
									<input
										type="url"
										defaultValue={f.url}
										onBlur={e => e.target.value && e.target.value !== f.url && void update(f.id, { url: e.target.value })}
									/>
								</td>
								<td>
									<button className="ta-btn ta-btn-small" onClick={() => void update(f.id, { active: !f.active })}>
										{f.active ? "Deactivate" : "Activate"}
									</button>{" "}
									<button className="ta-btn ta-btn-small ta-btn-ghost-danger" onClick={() => void remove(f)}>
										Delete
									</button>
								</td>
							</tr>
						))}
						<tr>
							<td />
							<td>
								<input
									type="text"
									placeholder="Form title"
									value={draft.title}
									onChange={e => setDraft({ ...draft, title: e.target.value })}
								/>
							</td>
							<td>
								<input
									type="text"
									placeholder="Optional description"
									value={draft.description}
									onChange={e => setDraft({ ...draft, description: e.target.value })}
								/>
							</td>
							<td>
								<input
									type="url"
									placeholder="https://forms.gle/…"
									value={draft.url}
									onChange={e => setDraft({ ...draft, url: e.target.value })}
								/>
							</td>
							<td>
								<button className="ta-btn ta-btn-small ta-btn-primary" onClick={() => void add()}>
									Add form
								</button>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);
}

export default function FormsPage() {
	return (
		<AdminShell title="Surveys & forms">
			<FormsManager />
		</AdminShell>
	);
}
