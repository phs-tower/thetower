/** @format */

import React from "react";

type Props = {
	url: string;
	className?: string;
	title?: string;
};

// Returns an embeddable Spotify URL if valid, otherwise null
function toEmbedUrl(rawUrl: string): { url: string; type: string } | null {
	try {
		const u = new URL(rawUrl);
		if (!u.hostname.endsWith("open.spotify.com")) return null;

		// Path looks like /{type}/{id}
		const parts = u.pathname.split("/").filter(Boolean);
		if (parts.length < 2) return null;

		const type = parts[0];
		const id = parts[1];

		const allowed = new Set(["track", "episode", "show", "playlist", "album"]);
		if (!allowed.has(type)) return null;

		return { url: `https://open.spotify.com/embed/${type}/${id}`, type };
	} catch {
		return null;
	}
}

export default function SpotifyEmbed({ url, className, title }: Props) {
	const parsed = toEmbedUrl(url);
	if (!parsed) return null;
	const embedUrl = parsed.url;
	const isEpisode = parsed.type === "episode";
	const height = isEpisode ? 352 : 232; // Taller episode player; others get a bit shorter

	return (
		<section className={className} aria-label="Listen on Spotify">
			{title && <h3>{title}</h3>}
			<div className="spotify-iframe-wrapper">
				<iframe
					src={embedUrl}
					width="100%"
					height={height}
					frameBorder="0"
					allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
					allowFullScreen
					loading="lazy"
					title="Spotify player"
					style={{ borderRadius: 12 }}
				/>
			</div>
			<div className="spotify-external-link">
				<a href={url} target="_blank" rel="noopener noreferrer">
					Open in Spotify
				</a>
			</div>
			<style jsx>{`
				section {
					border: 1px solid var(--accent-light);
					border-radius: 8px;
					background: #fafbfc;
					padding: 0.75rem 1rem 0.75rem 1rem;
					margin: 1.5rem 0;
					box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
				}
				h3 {
					margin: 0 0 0.5rem 0;
					font-family: var(--font-sans-bold);
					font-size: 0.95rem;
					letter-spacing: 0.02em;
					color: var(--accent-dark);
					text-transform: uppercase;
				}
				.spotify-iframe-wrapper {
					overflow: hidden;
					border-radius: 6px;
				}
				.spotify-external-link {
					margin-top: 0.5rem;
					text-align: right;
				}
				.spotify-external-link a {
					color: var(--accent);
					text-decoration: underline;
					font-family: var(--font-sans);
					font-size: 0.9rem;
				}
			`}</style>
		</section>
	);
}
