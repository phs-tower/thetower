/** @format */

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { Session, SupabaseClient } from "@supabase/supabase-js";
import { consoleSupabase } from "~/lib/console/supabase";

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

export default function AdminShell({ title, children }: { title: string; children: ReactNode }) {
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
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
				{/* eslint-disable-next-line @next/next/no-page-custom-font */}
				<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
			</Head>
			{gate.kind === "loading" && <CenterCard>Loading…</CenterCard>}
			{gate.kind === "signedout" && <Login supabase={supabase} />}
			{gate.kind === "noteditor" && <NotEditor supabase={supabase} email={gate.email} />}
			{gate.kind === "editor" && (
				<AdminContext.Provider value={{ supabase, session: gate.session, email: gate.email, role: gate.role }}>
					<Chrome title={title} email={gate.email} supabase={supabase}>
						{children}
					</Chrome>
				</AdminContext.Provider>
			)}
		</div>
	);
}

function CenterCard({ children }: { children: ReactNode }) {
	return (
		<div className="ta-center">
			<div className="ta-card ta-center-card">{children}</div>
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
		<div className="ta-center">
			<form className="ta-card ta-center-card ta-login" onSubmit={submit}>
				<div className="ta-login-brand">
					<span className="ta-login-mark">T</span>
					<div>
						<h1>The Tower Console</h1>
						<p>Editorial board sign-in</p>
					</div>
				</div>
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
				<p className="ta-muted ta-small">Accounts are created by invitation. Ask a console admin if you need access.</p>
			</form>
		</div>
	);
}

function NotEditor({ supabase, email }: { supabase: SupabaseClient; email: string }) {
	return (
		<CenterCard>
			<h1>Not an editor</h1>
			<p>
				You are signed in as <b>{email}</b>, but that account is not on the editor list, so the console is off-limits.
			</p>
			<p className="ta-muted">If you should have access, ask a console admin to add your email to the editor list.</p>
			<button className="ta-btn" onClick={() => supabase.auth.signOut()}>
				Sign out
			</button>
		</CenterCard>
	);
}

function Chrome({ title, email, supabase, children }: { title: string; email: string; supabase: SupabaseClient; children: ReactNode }) {
	const router = useRouter();
	const [menuOpen, setMenuOpen] = useState(false);

	useEffect(() => {
		setMenuOpen(false);
	}, [router.asPath]);

	return (
		<div className="ta-chrome">
			<aside className={`ta-sidebar${menuOpen ? " open" : ""}`}>
				<Link href="/admin" className="ta-logo">
					<span className="ta-logo-mark">T</span>
					<span>
						Tower <em>Console</em>
					</span>
				</Link>
				<nav>
					{NAV.map(item => {
						const active = item.href === "/admin" ? router.pathname === "/admin" : router.pathname.startsWith(item.href);
						return (
							<Link key={item.href} href={item.href} className={active ? "active" : ""}>
								{item.label}
							</Link>
						);
					})}
				</nav>
				<div className="ta-sidebar-foot">
					<span title={email}>{email}</span>
					<button onClick={() => supabase.auth.signOut()}>Sign out</button>
				</div>
			</aside>
			<div className="ta-main">
				<header className="ta-topbar">
					<button className="ta-menu-btn" aria-label="Menu" onClick={() => setMenuOpen(!menuOpen)}>
						☰
					</button>
					<h1>{title}</h1>
				</header>
				<div className="ta-content">{children}</div>
			</div>
			{menuOpen && <div className="ta-scrim" onClick={() => setMenuOpen(false)} />}
		</div>
	);
}
