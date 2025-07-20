/** @format */
import Link from "next/link";
import { months } from "~/lib/constants";
// import styles from "~/lib/styles";

import styles from "./archive.client.module.scss";

interface Props {
	month: number;
	year: number;
}

export default function VirtualArchive({ month, year }: Props) {
	const img = "/assets/default.png";

	return <Link className={styles.archive} href={`/archives/${year}/${month}`}>{`${months[month]} ${year}`}</Link>;
}
