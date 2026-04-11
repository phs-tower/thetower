/** @format */

import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { buildPublicStorageUrl, buildStorageUploadKey, SUPABASE_URL } from "~/lib/storage";

const serviceRole = process.env.SERVICE_ROLE;
const supabase = serviceRole ? createClient(`${SUPABASE_URL}/`, serviceRole) : null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "POST") return res.status(405).json({ message: "Invalid method" });
	if (!supabase) return res.status(500).json({ message: "Supabase storage is not configured." });

	const filename = `${req.body?.filename || ""}`.trim();
	if (!filename) return res.status(400).json({ message: "An image filename is required." });

	try {
		const path = buildStorageUploadKey(filename, "webp");
		const { data, error } = await supabase.storage.from("images").createSignedUploadUrl(path, { upsert: true });

		if (error || !data) {
			return res.status(Number((error as any)?.status || (error as any)?.statusCode) || 500).json({
				message: error?.message || "Could not prepare the article image upload.",
			});
		}

		return res.status(200).json({
			signedUrl: data.signedUrl,
			path: data.path,
			token: data.token,
			publicUrl: buildPublicStorageUrl("images", data.path),
		});
	} catch (error) {
		return res.status(500).json({ message: `Could not prepare the article image upload. ${error}` });
	}
}
