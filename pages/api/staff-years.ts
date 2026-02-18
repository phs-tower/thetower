/** @format */

import type { NextApiRequest, NextApiResponse } from "next";
import { getStaffYearsFromContent } from "~/lib/staff.server";

export type StaffYearsResponse = {
	years: number[];
};

export default function handler(_req: NextApiRequest, res: NextApiResponse<StaffYearsResponse>) {
	res.status(200).json({ years: getStaffYearsFromContent() });
}
