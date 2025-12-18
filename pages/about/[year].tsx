/** @format */

import Head from "next/head";
import CreditLink from "~/components/credit.client";

import styles from "./about.module.scss";

type Member = {
	name: string;
	position: string;
	sections?: string[];
	pictureUrl?: string;
};
/** @todo make these profile pic tiles instead of just links (hover --> show description) */

type Section = {
	name: string;
	members: Member[];
};

interface Props {
	year: number;
	sections: Section[];
}

interface Params {
	params: {
		year: string;
	};
}

export async function getStaticPaths() {
	return {
		paths: [{ params: { year: "2022" } }, { params: { year: "2023" } }, { params: { year: "2024" } }, { params: { year: "2025" } }],
		fallback: false,
	};
}

export async function getStaticProps({ params }: Params) {
	let data = await import(`~/content/${params.year}.json`);
	return {
		props: {
			year: params.year,
			sections: data.sections,
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
