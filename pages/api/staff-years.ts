/** @format */

import type { NextApiRequest, NextApiResponse } from "next";
import { getStaffYearsFromContent } from "~/lib/staff.server";

export type StaffYearsResponse = {
	years: number[];
};

export default function handler(_req: NextApiRequest, res: NextApiResponse<StaffYearsResponse>) {
	res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
	res.status(200).json({ years: getStaffYearsFromContent() });
}
