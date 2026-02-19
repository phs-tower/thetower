/** @format */

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "~/lib/styles";

const DISMISS_KEY = "tower_promo_dismissed_at";
const DISMISS_DAYS = 3;

const isDismissed = () => {
	if (typeof window === "undefined") return false;
	try {
		const raw = localStorage.getItem(DISMISS_KEY);
		if (!raw) return false;
		const ts = Number(raw);
		if (!Number.isFinite(ts)) return false;
		const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
		return ageDays < DISMISS_DAYS;
	} catch {
		return false;
	}
};

export default function PromoPopup() {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (isDismissed()) return;
		let timeoutId: ReturnType<typeof setTimeout> | null = null;
		let triggered = false;

		const maybeOpen = () => {
			if (triggered || open) return;
			if (window.scrollY < 500) return;
			triggered = true;
			timeoutId = setTimeout(() => setOpen(true), 350);
			window.removeEventListener("scroll", maybeOpen);
		};

		window.addEventListener("scroll", maybeOpen, { passive: true });
		// In case user reloads mid-scroll
		maybeOpen();

		return () => {
			window.removeEventListener("scroll", maybeOpen);
			if (timeoutId) clearTimeout(timeoutId);
		};
	}, []);

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") close();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [open]);

	const close = () => {
		setOpen(false);
		try {
			localStorage.setItem(DISMISS_KEY, String(Date.now()));
		} catch {
			// ignore storage errors
		}
	};

	return (
		<>
			<div className="promo-bubble-stack">
				<a
					className="promo-bubble"
					href="https://docs.google.com/forms/d/e/1FAIpQLSfYkeJynVHL3mKkBoeNiY51_aMv1ViwiSe0fD8Q3LbCo7nngA/viewform"
					target="_blank"
					rel="noreferrer"
				>
					Interested in writing?
				</a>
			</div>
			{open && (
				<div className="promo-overlay" role="dialog" aria-modal="true" aria-label="Subscribe or Contribute">
					<div className="promo-card">
						<button className="promo-close" onClick={close} aria-label="Close">
							×
						</button>
						<div className="promo-kicker">Support Student Journalism</div>
						<h2>Subscribe or Contribute</h2>
						<p>
							Help keep <span className="emph">The Tower</span> thriving. Subscribe to the print edition, or write, photograph, and
							create with us.
						</p>
						<div className="promo-actions">
							<Link href="/subscribe" legacyBehavior>
								<a className="secondary" onClick={close}>
									Subscribe
								</a>
							</Link>
							<a
								href="https://docs.google.com/forms/d/e/1FAIpQLSfYkeJynVHL3mKkBoeNiY51_aMv1ViwiSe0fD8Q3LbCo7nngA/viewform"
								target="_blank"
								rel="noreferrer"
								className="secondary"
								onClick={close}
							>
								Contribute / Write
							</a>
						</div>
						<button className="promo-later" onClick={close}>
							Remind me later
						</button>
					</div>
				</div>
			)}
			<style jsx>{`
				.promo-bubble-stack {
					position: fixed;
					right: 1.25rem;
					bottom: 1.25rem;
					display: flex;
					flex-direction: column;
					gap: 0.6rem;
					z-index: 1500;
				}
				.promo-bubble {
					background: ${styles.color.accent};
					color: #fff;
					padding: 0.65rem 1rem;
					border-radius: 999px;
					text-decoration: none;
					font-weight: 600;
					font-size: 0.95rem;
					letter-spacing: 0.01em;
					box-shadow: 0 10px 24px rgba(0, 0, 0, 0.25);
					border: 1px solid rgba(255, 255, 255, 0.15);
					min-width: 0;
					text-align: center;
					white-space: nowrap;
					position: relative;
					overflow: hidden;
					transform: translateY(0) scale(1);
					transition: transform 0.22s ease, box-shadow 0.22s ease, background 0.22s ease, opacity 0.22s ease;
				}
				.promo-bubble::before {
					content: "";
					position: absolute;
					top: -30%;
					left: -70%;
					width: 45%;
					height: 160%;
					transform: rotate(18deg);
					background: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.32), rgba(255, 255, 255, 0));
					pointer-events: none;
					transition: left 0.4s ease;
				}
				.promo-bubble:hover {
					background: ${styles.color.darkAccent};
					opacity: 1;
					transform: translateY(-2px) scale(1.02);
					box-shadow: 0 14px 30px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.12) inset;
				}
				.promo-bubble:hover::before {
					left: 130%;
				}
				.promo-bubble:active {
					transform: translateY(0) scale(0.99);
				}
				.promo-bubble:focus-visible {
					outline: 2px solid #fff;
					outline-offset: 2px;
				}
				.promo-overlay {
					position: fixed;
					inset: 0;
					display: grid;
					place-items: center;
					background: rgba(0, 0, 0, 0.28);
					backdrop-filter: blur(2px);
					z-index: 2000;
					padding: 1.5rem;
					animation: overlay-in 260ms ease-out;
				}
				.promo-card {
					background: #f9fbff;
					border-radius: 0.85rem;
					padding: 2rem 2.25rem 1.5rem;
					max-width: 32rem;
					width: 100%;
					box-shadow: 0 16px 36px rgba(0, 0, 0, 0.16);
					position: relative;
					animation: popup-in 260ms ease-out;
					border: 1px solid #e9eef5;
				}
				.promo-close {
					position: absolute;
					top: 0.75rem;
					right: 0.85rem;
					border: none;
					background: transparent;
					font-size: 1.5rem;
					color: #666;
					cursor: pointer;
					width: 2rem;
					height: 2rem;
					border-radius: 999px;
					display: grid;
					place-items: center;
					transition: background 0.2s ease, color 0.2s ease, transform 0.15s ease;
				}
				.promo-close:hover {
					background: rgba(6, 27, 64, 0.08);
					color: ${styles.color.accent};
				}
				.promo-close:active {
					transform: scale(0.96);
				}
				.promo-close:focus-visible {
					outline: 2px solid ${styles.color.accent};
					outline-offset: 2px;
				}
				.promo-kicker {
					color: rgba(6, 27, 64, 0.7);
					font-weight: 700;
					letter-spacing: 0.12em;
					text-transform: uppercase;
					font-size: 0.7rem;
					margin-bottom: 0.5rem;
				}
				h2 {
					margin: 0 0 0.75rem;
					font-size: 1.8rem;
					color: ${styles.color.primary};
				}
				p {
					margin: 0 0 1.5rem;
					color: #5a5a5a;
					line-height: 1.45;
				}
				.emph {
					font-family: ${styles.font.serifHeader};
					color: ${styles.color.accent};
					font-style: italic;
				}
				.promo-actions {
					display: flex;
					gap: 0.75rem;
					flex-wrap: wrap;
					align-items: center;
				}
				.promo-actions .secondary {
					padding: 0.7rem 1.2rem;
					border-radius: 0.6rem;
					text-decoration: none;
					font-weight: 600;
					font-size: 1.05rem;
					border: 1px solid ${styles.color.accent};
					color: ${styles.color.accent};
				}
				.promo-actions .secondary:hover {
					background: ${styles.color.darkAccent};
					color: #fff;
					border-color: ${styles.color.darkAccent};
				}
				.promo-later {
					margin-top: 0.85rem;
					border: none;
					background: none;
					color: #8b8b8b;
					cursor: pointer;
					padding: 0;
					border-radius: 0;
					font-weight: 500;
					font-size: 0.9rem;
					letter-spacing: 0;
					transition: color 0.2s ease, text-decoration-color 0.2s ease;
				}
				.promo-later:hover {
					color: ${styles.color.accent};
					text-decoration: underline;
					text-underline-offset: 3px;
				}
				.promo-later:active {
					transform: none;
				}
				.promo-later:focus-visible {
					outline: 2px solid ${styles.color.accent};
					outline-offset: 2px;
				}
				@keyframes popup-in {
					from {
						opacity: 0;
						transform: translateY(10px) scale(0.98);
					}
					to {
						opacity: 1;
						transform: translateY(0) scale(1);
					}
				}
				@keyframes overlay-in {
					from {
						opacity: 0;
					}
					to {
						opacity: 1;
					}
				}
				@media (max-width: 520px) {
					.promo-card {
						padding: 1.5rem 1.5rem 1.2rem;
					}
					h2 {
						font-size: 1.5rem;
					}
					.promo-bubble-stack {
						right: 0.75rem;
						bottom: 0.75rem;
						gap: 0.4rem;
					}
					.promo-bubble {
						padding: 0.6rem 0.9rem;
						min-width: 0;
					}
				}
			`}</style>
		</>
	);
}
