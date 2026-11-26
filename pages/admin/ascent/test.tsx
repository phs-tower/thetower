/** @format */

import AdminShell from "~/components/admin/AdminShell";
import { AscentTabs } from "~/components/admin/AscentKit";
import { AscentWeek } from "~/components/admin/AscentWeek";

// The sandbox week, Monday to Sunday: prompts scheduled here are unpublished
// copies (ascent_schedule_test), so readers never see them.
export default function AscentTestWeekPage() {
	return (
		<AdminShell title="The Ascent · Test week" wide>
			<AscentTabs />
			<AscentWeek test />
		</AdminShell>
	);
}
