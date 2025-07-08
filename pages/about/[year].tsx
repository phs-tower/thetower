/** @format */

import Head from "next/head";
import CreditLink from "~/components/credit.client";

type Member = {
	name: string;
	position: string;
};

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
		<div className="about">
			<Head>
				<title>{`${year} Staff | The Tower`}</title>
				<meta property="og:title" content={`About the ${year} staff | The Tower`} />
				<meta property="og:description" content={`About the ${year} staff of the Tower`} />
			</Head>
			<style jsx>{`
				.about {
					margin-left: 9%;
					margin-right: 9%;
					text-align: center;
				}
				h1 {
					text-align: center;
					border-bottom: 3px solid gainsboro;
				}
				h2 {
					margin-top: 4vh;
					margin-bottom: 1vh;
				}
			`}</style>
			{/* omg this is disgusting ^^^ */}
			<h1>{year} Staff</h1>
			{sections.map((section, index) => (
				<>
					<h2 key={index}>{section.name}</h2>
					{section.members.map((member, index) => (
						<>
							<CreditLink key={index} author={member.name} />
							<span style={{ fontSize: "18px" }}>, {member.position}</span>
							<br />
						</>
					))}
				</>
			))}
			<h2>Advisors</h2>
			<span style={{ fontSize: "18px" }}>Lauren King</span>
			<br></br>
			<span style={{ fontSize: "18px" }}>Doug Levandowski</span>
		</div>
	);
}
