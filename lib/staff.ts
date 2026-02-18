/** @format */

export type StaffMember = {
	name: string;
	position: string;
	sections?: string[];
	pictureUrl?: string;
};

export type StaffSection = {
	name: string;
	members: StaffMember[];
};

const parseYearsFromEnv = (): number[] => {
	const raw = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_STAFF_YEARS : undefined;
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.map(year => parseInt(`${year}`, 10))
			.filter((year): year is number => Number.isFinite(year))
			.sort((a, b) => b - a);
	} catch {
		return [];
	}
};

const staffYears = parseYearsFromEnv();

export const staffMenuItems = staffYears.map(year => ({
	name: `${year} Staff`,
	href: `/about/${year}`,
}));

export function getStaffYears(): number[] {
	return staffYears;
}
