/** @format */

import fs from "fs";
import path from "path";

import type { StaffSection } from "./staff";

const contentDir = path.join(process.cwd(), "content");

const normalizeYear = (year: string | number): number => parseInt(`${year}`, 10);

const readContentFiles = (): string[] => {
	try {
		return fs.readdirSync(contentDir);
	} catch {
		return [];
	}
};

export function getStaffYearsFromContent(): number[] {
	return readContentFiles()
		.map(file => /^(\d{4})\.json$/i.exec(file)?.[1])
		.filter(Boolean)
		.map(year => parseInt(year as string, 10))
		.sort((a, b) => b - a);
}

export function staffYearExists(year: string | number): boolean {
	const normalized = normalizeYear(year);
	if (!Number.isFinite(normalized)) return false;
	return fs.existsSync(path.join(contentDir, `${normalized}.json`));
}

export function getStaffSections(year: string | number): StaffSection[] {
	const normalized = normalizeYear(year);
	if (!Number.isFinite(normalized)) return [];
	const file = path.join(contentDir, `${normalized}.json`);
	try {
		const raw = fs.readFileSync(file, "utf8");
		const data = JSON.parse(raw) as { sections?: StaffSection[] };
		return data.sections || [];
	} catch {
		return [];
	}
}
