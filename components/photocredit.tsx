/** @format */

import { useMemo } from "react";
import styles from "~/lib/styles";

interface Props {
	contentInfo: string;
}

export default function PhotoCredit({ contentInfo }: Props) {
	const { creditLine, contextLine } = useMemo(() => {
		if (!contentInfo) return { creditLine: null, contextLine: null };

		const lines = contentInfo.trim().split(/\n+/);
		const firstLine = lines[0];

		let creditLine = null;
		let matched = false;

		if (firstLine.includes(":")) {
			const [label, value] = firstLine.split(":");
			const lowerLabel = label.trim().toLowerCase();

			if (lowerLabel.includes("photo") || lowerLabel.includes("image") || lowerLabel.includes("graphic")) {
				const words = value
					.trim()
					.replace(/,/g, "") // remove commas
					.split(/\s+/);

				const keyword = capitalize(lowerLabel.split(" ")[0]);
				const names: string[] = [];

				const firstName = words.slice(0, 2).join(" ");
				names.push(firstName);

				const andIndex = words.findIndex(w => w.toLowerCase() === "and");
				if (andIndex !== -1 && words.length > andIndex + 2) {
					const secondName = words.slice(andIndex + 1, andIndex + 3).join(" ");
					names.push(secondName);
				}

				const links = names
					.map(name => `<a href="/credit/${encodeURIComponent(name)}" class="photoLink">${escapeHTML(name)}</a>`)
					.join(" and ");

				creditLine = `${keyword}: ${links}`;
				matched = true;
				lines.shift(); // Remove matched line
			}
		}

		const contextLine = matched ? lines.join("\n").trim() : contentInfo.trim();
		return { creditLine, contextLine };
	}, [contentInfo]);

	if (!creditLine && !contextLine) return null;

	return (
		<>
			<style jsx>{`
				.photoCredit {
					font-family: ${styles.font.sans};
					font-size: 1.1rem;
					color: #5e5e5e;
					margin-top: 0.4rem; /* closer to image */
					margin-bottom: 0.05rem; /* tighter with context */
				}

				.photoContext {
					font-family: ${styles.font.sans};
					font-size: 1rem;
					color: #8b8b8b;
					margin-bottom: 0.75rem;
					margin-top: 0; /* no extra gap */
					white-space: pre-line;
				}

				p :global(a.photoLink) {
					color: #5e5e5e !important;
					text-decoration: none !important;
				}

				p :global(a.photoLink:hover) {
					text-decoration-line: underline !important;
				}
			`}</style>

			{creditLine && <p className="photoCredit" dangerouslySetInnerHTML={{ __html: creditLine }} />}
			{contextLine && <p className="photoContext">{contextLine}</p>}
		</>
	);
}

function capitalize(str: string) {
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function escapeHTML(str: string) {
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
