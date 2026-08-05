/** @format */

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { Session, SupabaseClient } from "@supabase/supabase-js";
import { consoleSupabase } from "~/lib/console/supabase";
import { displayFullDate } from "~/lib/utils";

type EditorRole = "admin" | "editor";

interface AdminContextValue {
	supabase: SupabaseClient;
	session: Session;
	email: string;
	role: EditorRole;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
	const ctx = useContext(AdminContext);
	if (!ctx) throw new Error("useAdmin must be used inside <AdminShell>");
	return ctx;
}

const NAV = [
	{ href: "/admin", label: "Dashboard" },
	{ href: "/admin/blurbs", label: "Blurbs" },
	{ href: "/admin/letters", label: "Letters" },
	{ href: "/admin/layout", label: "App layout" },
	{ href: "/admin/schedule", label: "Schedule" },
	{ href: "/admin/forms", label: "Forms" },
	{ href: "/admin/crossword", label: "Crosswords" },
	{ href: "/admin/vanguard", label: "Vanguard" },
	{ href: "/admin/push", label: "Push" },
];

type GateState =
	| { kind: "loading" }
	| { kind: "signedout" }
	| { kind: "noteditor"; email: string }
	| { kind: "editor"; session: Session; email: string; role: EditorRole };

export default function AdminShell({ title, wide, children }: { title: string; wide?: boolean; children: ReactNode }) {
	const supabase = consoleSupabase();
	const [gate, setGate] = useState<GateState>({ kind: "loading" });

	useEffect(() => {
		let cancelled = false;

		const resolve = async (session: Session | null) => {
			if (cancelled) return;
			if (!session?.user?.email) {
				setGate({ kind: "signedout" });
				return;
			}
			const email = session.user.email;
			// RLS on public.editor: non-editors see zero rows, including their own.
			const { data, error } = await supabase.from("editor").select("email, role").eq("email", email).maybeSingle();
			if (cancelled) return;
			if (error || !data) {
				setGate({ kind: "noteditor", email });
				return;
			}
			setGate({ kind: "editor", session, email, role: data.role === "admin" ? "admin" : "editor" });
		};

		supabase.auth.getSession().then(({ data }) => resolve(data.session));
		const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
			void resolve(session);
		});
		return () => {
			cancelled = true;
			sub.subscription.unsubscribe();
		};
	}, [supabase]);

	return (
		<div className="ta-root">
			<Head>
				<title>{`${title} | Tower Console`}</title>
				<meta name="robots" content="noindex, nofollow" />
			</Head>
			{gate.kind === "loading" && (
				<Gate>
					<p className="ta-gate-body ta-muted">Loading…</p>
				</Gate>
			)}
			{gate.kind === "signedout" && <Login supabase={supabase} />}
			{gate.kind === "noteditor" && <NotEditor supabase={supabase} email={gate.email} />}
			{gate.kind === "editor" && (
				<AdminContext.Provider value={{ supabase, session: gate.session, email: gate.email, role: gate.role }}>
					<Chrome title={title} email={gate.email} supabase={supabase} wide={wide}>
						{children}
					</Chrome>
				</AdminContext.Provider>
			)}
		</div>
	);
}

/** The signed-out shell: the paper's own front page, not a product login card. */
function Gate({ children }: { children: ReactNode }) {
	return (
		<div className="ta-gate">
			<div className="ta-gate-inner">
				<div className="ta-gate-wordmark">The Tower</div>
				<div className="ta-gate-rules">Editorial Console</div>
				{children}
			</div>
		</div>
	);
}

function Login({ supabase }: { supabase: SupabaseClient }) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setError(null);
		const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
		if (err) setError(err.message);
		setBusy(false);
	};

	return (
		<Gate>
			<form className="ta-gate-form" onSubmit={submit}>
				<label>
					Email
					<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required autoFocus />
				</label>
				<label>
					Password
					<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
				</label>
				{error && <p className="ta-error">{error}</p>}
				<button className="ta-btn ta-btn-primary" type="submit" disabled={busy}>
					{busy ? "Signing in…" : "Sign in"}
				</button>
			</form>
			<p className="ta-gate-note">Accounts are issued by invitation. Ask a console admin if you need access.</p>
		</Gate>
	);
}

function NotEditor({ supabase, email }: { supabase: SupabaseClient; email: string }) {
	return (
		<Gate>
			<p className="ta-gate-body">
				You are signed in as <b>{email}</b>, but that account is not on the editor list, so the console is closed to it.
			</p>
			<p className="ta-gate-body ta-muted ta-small">If you should have access, ask a console admin to add your email to the editor list.</p>
			<button className="ta-btn" onClick={() => supabase.auth.signOut()}>
				Sign out
			</button>
		</Gate>
	);
}

function Chrome({
	title,
	email,
	supabase,
	wide,
	children,
}: {
	title: string;
	email: string;
	supabase: SupabaseClient;
	wide?: boolean;
	children: ReactNode;
}) {
	const router = useRouter();
	const [menuOpen, setMenuOpen] = useState(false);

	useEffect(() => {
		setMenuOpen(false);
	}, [router.asPath]);

	return (
		<>
			<header className="ta-masthead">
				<Link href="/admin" className="ta-masthead-logo">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src="/assets/tower-short.png" alt="" draggable="false" />
					<h1>The Tower</h1>
				</Link>
				<span className="ta-masthead-tag">Console</span>
				<div className="ta-masthead-sides">
					<p className="ta-masthead-date" suppressHydrationWarning>
						{displayFullDate().toUpperCase()}
					</p>
					<div className="ta-masthead-user">
						<span className="ta-masthead-email">{email}</span>
						<button className="ta-btn ta-btn-small" onClick={() => supabase.auth.signOut()}>
							Sign out
						</button>
					</div>
				</div>
			</header>
			<nav className="ta-nav" data-open={menuOpen ? "true" : "false"}>
				<button className="ta-nav-toggle" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
					{menuOpen ? "✕ Close" : "☰ Sections"}
				</button>
				<div className="ta-nav-links">
					{NAV.map(item => {
						const active = item.href === "/admin" ? router.pathname === "/admin" : router.pathname.startsWith(item.href);
						return (
							<Link key={item.href} href={item.href} className={active ? "active" : ""}>
								{item.label}
							</Link>
						);
					})}
				</div>
			</nav>
			<main className={`ta-content${wide ? " wide" : ""}`}>
				<h1 className="ta-page-title">{title}</h1>
				{children}
			</main>
		</>
	);
}
