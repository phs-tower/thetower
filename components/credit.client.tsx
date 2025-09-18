/** @format */

import Link from "next/link";
import styles from "~/lib/styles";

const enum FontOptions {
	sans = "sans",
	serif = "serif",
}

interface Props {
	author: string;
	small?: boolean;
	font?: FontOptions;
}

export default function CreditLink({ author, small, font }: Props) {
	return (
		<>
			<style jsx>{`
				a {
					color: #8b8b8b;
					font-family: ${!font || font == "sans" ? "font-family: var(--font-sans)" : "font-family:var(--font-serif-text)"};
				}
				a:hover {
					text-decoration: underline;
					color: rgb(94, 150, 229) !important; /* blueish hover */
				}
			`}</style>
			<Link legacyBehavior className="credit-link" href={"/credit/" + encodeURI(author)}>
				<a>{author}</a>
			</Link>
		</>
	);
}
