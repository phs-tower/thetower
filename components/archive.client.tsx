/** @format */
import Link from "next/link";
import { months } from "~/lib/constants";
// import styles from "~/lib/styles";

import styles from "./archive.client.module.scss";

interface Props {
	month: number;
	year: number;
	issueNumber: number;
}

export default function VirtualArchive({ month, year, issueNumber }: Props) {
	return (
		<Link className={styles.archive} href={`/archives/${year}/${month}`}>
			<span className={styles.kicker}>{`Issue ${issueNumber}`}</span>
			<strong className={styles.title}>{`${months[month]} ${year}`}</strong>
			<span className={styles.rule} />
			<span className={styles.cta}>View archive</span>
		</Link>
	);
}
