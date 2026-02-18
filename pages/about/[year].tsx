/** @format */

import Head from "next/head";
import CreditLink from "~/components/credit.client";
import type { StaffSection } from "~/lib/staff";
import { getStaffSections, getStaffYearsFromContent, staffYearExists } from "~/lib/staff.server";

import styles from "./about.module.scss";

interface Props {
	year: string;
	sections: StaffSection[];
}

interface Params {
	params: {
		year: string;
	};
}

export async function getStaticPaths() {
	const paths = getStaffYearsFromContent().map(year => ({ params: { year: year.toString() } }));
	return { paths, fallback: false };
}

export async function getStaticProps({ params }: Params) {
	const { year } = params;
	if (!staffYearExists(year)) {
		return { notFound: true };
	}

	return {
		props: {
			year,
			sections: getStaffSections(year),
		},
	};
}

export default function Year({ year, sections }: Props) {
	return (
		<div className={styles.about}>
			<Head>
				<title>{`${year} Staff | The Tower`}</title>
				<meta property="og:title" content={`About the ${year} staff | The Tower`} />
				<meta property="og:description" content={`About the ${year} staff of the Tower`} />
			</Head>
			<h1>{year} Staff</h1>
			{sections.map((section, index) => (
				<>
					<h2 key={index}>{section.name}</h2>
					<div className={styles.editors}>
						{section.members.map((member, index) => (
							<div className={styles.editor} key={index}>
								<CreditLink key={index} author={member.name} />
								<span>, {member.position}</span>
								<br />
							</div>
						))}
					</div>
				</>
			))}
			<h2>Advisors</h2>
			<span>Lauren King</span>
			<br></br>
			<span>Doug Levandowski</span>
		</div>
	);
}
