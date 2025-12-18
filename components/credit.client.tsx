/** @format */

import Link from "next/link";
import styles from "./credit.client.module.scss";

export default function CreditLink({ author }: { author: string }) {
	return (
		<Link className={styles["credit-link"]} href={"/credit/" + encodeURI(author)}>
			{author}
		</Link>
	);
}
