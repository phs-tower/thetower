/** @format */

import { spreads } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";
import { displayDate } from "~/lib/utils";
import styles from "~/lib/styles";

interface Props {
	spread: spreads;
}

export default function Spread({ spread }: Props) {
	return (
		<div className="spread">
			<style jsx>{`
				.spread {
					min-width: 50vh;
					justify-content: left;
					background-color: #f5f5f5;
					padding: 20px;
					margin-bottom: 10px;
					margin-top: 10px;
					border-left: 2px solid ${styles.color.accent};
				}

				a {
					font-size: 1.5rem;
				}

				a:hover {
					text-decoration: underline;
				}
				.title {
					/* font-weight: bolder;
					font-size: larger; */
				}

				span {
					font-family: ${styles.font.sans};
				}
			`}</style>
			<section className="title">
				<Link legacyBehavior href={"/spreads/" + spread.year + "/" + spread.month + "/vanguard/" + encodeURI(spread.title)}>
					<a>{spread.title}</a>
				</Link>
			</section>
			<span>{displayDate(spread.year, spread.month)}</span>
		</div>
	);
}
