/** @format */

import Link from "next/link";
import styles from "./subbanner.client.module.scss";

interface Props {
	title: String;
}

export default function SubBanner({ title }: Props) {
	return (
		<div>
			<div className={styles["sub-banner"]}>
				<hr />
				<h2>{title}</h2>
				<p>
					For $30.00 a year, subscribers to The Tower will receive all eight issues shipped to their home or business over the course of the
					year.
				</p>
				<br />
				<Link href="/subscribe" className={styles["sub-link"]}>
					Learn more
				</Link>
			</div>
		</div>
	);
}
