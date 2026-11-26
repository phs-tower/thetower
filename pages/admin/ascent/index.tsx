/** @format */

import AdminShell from "~/components/admin/AdminShell";
import { AscentTabs } from "~/components/admin/AscentKit";
import { AscentWeek } from "~/components/admin/AscentWeek";

export default function AscentWeekPage() {
	return (
		<AdminShell title="The Ascent" wide>
			<AscentTabs />
			<AscentWeek />
		</AdminShell>
	);
}
