/** @format */

import Link from "next/link";
import styles from "~/lib/styles";

interface Props {
	author: string;
	small?: boolean;
}

/** Link to an editor's page
 *
 * `small` does *literally nothing* so don't use it
 */
export default function CreditLink({ author, small }: Props) {
	return (
		<>
			<style jsx>{`
				a {
					${small ? "color: #8b8b8b;" : "color: #8b8b8b;"}
					font-family: ${styles.font.sans};
				}
				a:hover {
					text-decoration: underline;
				}
			`}</style>
			<Link legacyBehavior className="credit-link" href={"/credit/" + encodeURI(author)}>
				<a>{author}</a>
			</Link>
		</>
	);
}
