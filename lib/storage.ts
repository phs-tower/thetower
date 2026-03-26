/** @format */

import path from "path";
import { randomUUID } from "crypto";

export const SUPABASE_URL = "https://yusjougmsdnhcsksadaw.supabase.co";

export function buildStorageUploadKey(originalName: string, fallbackExt = "bin") {
	const base =
		path
			.basename(originalName, path.extname(originalName))
			.toLowerCase()
			.replace(/[^a-z0-9-_]+/gi, "-")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 60) || "upload";

	const ext = (
		path
			.extname(originalName)
			.slice(1)
			.toLowerCase()
			.replace(/[^a-z0-9]/gi, "") || fallbackExt
	).toLowerCase();
	const now = new Date();

	return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), `${base}-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`].join("/");
}

export function buildPublicStorageUrl(bucket: string, key: string) {
	const encodedKey = key
		.split("/")
		.filter(Boolean)
		.map(segment => encodeURIComponent(segment))
		.join("/");

	return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodedKey}`;
}
