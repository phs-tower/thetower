/** @format */

import Head from "next/head";
import { ChangeEvent, FormEvent, useEffect, useState, useRef, DragEvent } from "react";
import Link from "next/link";
import { remark } from "remark";
import html from "remark-html";
import confetti from "canvas-confetti";
import styles from "./upload.module.scss";
import { ArticleContent } from "../articles/[year]/[month]/[cat]/[slug]";
import { SpreadContent } from "../spreads/[year]/[month]/[cat]/[slug]";
import dynamic from "next/dynamic";

const Video = dynamic(() => import("~/components/video.client"), { ssr: false });
const Podcast = dynamic(() => import("~/components/podcast.client"), { ssr: false });

// Our form data shape (added contentInfo for header info)
type FormDataType = {
	category?: string | null;
	subcategory?: string | null;
	title?: string | null;
	authors?: string | null;
	content?: string | null;
	contentInfo?: string | null; // New header info field
	multi?: string | null;
	img?: File | null; // Not stored in localStorage
	spread?: File | null; // Not stored in localStorage
	imgData?: string | null;
	imgName?: string | null;
	month?: number | null;
	year?: number | null;
};

// 72 hours in ms
const THREE_DAYS_MS = 72 * 60 * 60 * 1000;

function SavingIndicator({ uploadStatus, isSaving }: { uploadStatus: string; isSaving: boolean }) {
	return (
		<div style={{ position: "fixed", bottom: "10px", right: "10px", textAlign: "right" }}>
			<span className={`upload-status ${uploadStatus}`} style={{ fontSize: "1.6rem", transition: "color 2s ease" }}>
				{isSaving ? (
					<>
						Saving...
						<span className={styles["spinner"]} />
					</>
				) : (
					"Saved!"
				)}
			</span>
			<br />
			<span style={{ fontSize: ".6rem", color: "#8b8b8b" }}>(Saves are stored for a maximum of 3 days)</span>
		</div>
	);
}

export default function Upload() {
	const [hydrated, setHydrated] = useState(false);
	const [formData, setFormData] = useState<FormDataType>({});
	const [category, setCategory] = useState<string>("");
	const [uploadResponse, setUploadResponse] = useState("");
	const [previewContent, setPreviewContent] = useState("");
	const [spreadData, setSpreadData] = useState<string>("");
	const [imgOrigBytes, setImgOrigBytes] = useState<number | null>(null);
	const [serverImgBytes, setServerImgBytes] = useState<number | null>(null);
	const [imgCompressedBytes, setImgCompressedBytes] = useState<number | null>(null);

	const errorRef = useRef<HTMLParagraphElement>(null);

	// Resizable preview panel
	const containerRef = useRef<HTMLDivElement>(null);
	const [dragging, setDragging] = useState(false);
	const [previewWidth, setPreviewWidth] = useState<number | null>(null); // px; 0 => hidden

	useEffect(() => {
		if (!hydrated) return;
		// Load saved width or set a sensible default based on container width
		const saved = localStorage.getItem("uploadPreviewWidthPx");
		let initial: number | null = null;
		if (saved && !Number.isNaN(Number(saved))) initial = Math.max(0, parseInt(saved, 10));
		if (initial === null || Number.isNaN(initial)) {
			const el = containerRef.current;
			if (el) {
				const rect = el.getBoundingClientRect();
				initial = Math.round(Math.min(Math.max(rect.width * 0.4, 320), 720));
			}
		}
		if (typeof initial === "number" && !Number.isNaN(initial)) setPreviewWidth(initial);
	}, [hydrated]);

	useEffect(() => {
		if (!dragging) return;
		function onMove(ev: MouseEvent) {
			const el = containerRef.current;
			if (!el) return;
			const rect = el.getBoundingClientRect();
			let next = Math.round(rect.right - ev.clientX);
			// Allow 0 (hidden) up to max leaving some space for inputs
			next = Math.max(0, Math.min(next, Math.max(240, rect.width - 260)));
			setPreviewWidth(next);
		}
		function onUp() {
			setDragging(false);
			if (previewWidth !== null) localStorage.setItem("uploadPreviewWidthPx", String(previewWidth));
		}
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
		return () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};
	}, [dragging, previewWidth]);

	function startDrag(e: React.MouseEvent<HTMLDivElement>) {
		e.preventDefault();
		setDragging(true);
	}

	// Saving indicator state
	const [isSaving, setIsSaving] = useState(false);
	// New upload status state: "normal" | "success" | "error"
	const [uploadStatus, setUploadStatus] = useState<"normal" | "success" | "error">("normal");

	// Reset uploadStatus to "normal" after 3 seconds when it's not normal
	useEffect(() => {
		if (uploadStatus !== "normal") {
			const timer = setTimeout(() => setUploadStatus("normal"), 3000);
			return () => clearTimeout(timer);
		}
	}, [uploadStatus]);

	useEffect(() => {
		setHydrated(true);

		// Load saved data from localStorage if saved within 3 days
		const stored = localStorage.getItem("uploadFormData");
		const timestamp = localStorage.getItem("uploadFormTimestamp");

		if (!(stored && timestamp)) return;

		const ts = parseInt(timestamp, 10);
		if (Date.now() - ts < THREE_DAYS_MS) {
			const loaded = JSON.parse(stored);
			setFormData(loaded);
			if (loaded.category) setCategory(loaded.category);
		} else {
			localStorage.removeItem("uploadFormData");
			localStorage.removeItem("uploadFormTimestamp");
		}
	}, []);

	// Save to localStorage on every update
	useEffect(() => {
		if (!hydrated) return;
		setIsSaving(true);
		const { category, subcategory, title, authors, content, multi, contentInfo, month, year } = formData;
		const fieldsToStore = { category, subcategory, title, authors, content, multi, contentInfo, month, year };
		try {
			localStorage.setItem("uploadFormData", JSON.stringify(fieldsToStore));
			localStorage.setItem("uploadFormTimestamp", Date.now().toString());
		} catch (err) {
			console.warn("Storing to localStorage failed:", err);
		}
		const timer = setTimeout(() => {
			setIsSaving(false);
		}, 1500);
		return () => clearTimeout(timer);
	}, [formData, hydrated]);

	// Process Markdown -> HTML when content changes
	useEffect(() => {
		if (hydrated && formData.content) {
			remark()
				.use(html)
				.process(formData.content)
				.then(processed => setPreviewContent(processed.toString()))
				.catch(err => console.error("Markdown processing error:", err));
		}
	}, [hydrated, formData.content]);

	// Re-trigger error animation
	function triggerErrorAnimation() {
		if (errorRef.current) {
			errorRef.current.classList.remove("error-message");
			void errorRef.current.offsetWidth;
			errorRef.current.classList.add("error-message");
		}
	}

	function formatBytes(bytes: number | null | undefined) {
		if (bytes === null || bytes === undefined) return "";
		const units = ["B", "KB", "MB", "GB"] as const;
		let b = bytes;
		let i = 0;
		while (b >= 1024 && i < units.length - 1) {
			b /= 1024;
			i++;
		}
		return `${Math.round(b * 10) / 10} ${units[i]}`;
	}

	function changeCategory(e: ChangeEvent<HTMLSelectElement>) {
		setCategory(e.target.value);
		setFormData({ ...formData, category: e.target.value });
	}

	function changeSubcategory(e: ChangeEvent<HTMLSelectElement>) {
		setFormData({ ...formData, subcategory: e.target.value });
	}

	function updateTitle(e: ChangeEvent<HTMLInputElement>) {
		setFormData({ ...formData, title: e.target.value });
	}

	function updateAuthors(e: ChangeEvent<HTMLInputElement>) {
		setFormData({ ...formData, authors: e.target.value });
	}

	function changeMonth(e: ChangeEvent<HTMLSelectElement>) {
		const m = parseInt(e.target.value, 10);
		if (!isNaN(m)) setFormData({ ...formData, month: m });
	}

	function changeYear(e: ChangeEvent<HTMLInputElement>) {
		const y = parseInt(e.target.value, 10);
		setFormData({ ...formData, year: !isNaN(y) ? y : null });
	}

	async function updateContent(e: ChangeEvent<HTMLTextAreaElement>) {
		setFormData({ ...formData, content: e.target.value });
		const processed = await remark().use(html).process(e.target.value);
		setPreviewContent(processed.toString());
	}

	// New: Update Header Info from a resizable textarea
	function updateHeaderInfo(e: ChangeEvent<HTMLTextAreaElement>) {
		setFormData({ ...formData, contentInfo: e.target.value });
	}

	async function updateImage(inp: HTMLInputElement) {
		if (!inp.files || !inp.files[0]) return;
		let image = inp.files[0];

		const validExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
		const nameLower = image.name.toLowerCase();
		if (!validExtensions.some(ext => nameLower.endsWith(ext))) {
			alert("Invalid file format. Please select a JPG, JPEG, PNG, WEBP, or GIF file.");
			inp.value = "";
			setFormData({ ...formData, img: null, imgData: null, imgName: null });
			setSpreadData("");
			return;
		}

		// Track original size and preview the original (no client compression)
		setImgOrigBytes(image.size);
		const reader = new FileReader();
		reader.onload = () => {
			setFormData({
				...formData,
				img: image,
				imgData: reader.result as string,
				imgName: image.name,
			});
		};
		reader.readAsDataURL(image);
	}

	function clearImage() {
		setFormData({ ...formData, img: null, imgData: null, imgName: null });
		setImgOrigBytes(null);
		setServerImgBytes(null);
		const inp = document.getElementById("img-upload") as HTMLInputElement | null;
		if (inp) {
			inp.value = "";
			if (inp.parentElement) {
				inp.parentElement.classList.remove(styles["has-file"]);
			}
		}
	}

	// Update PDF spread (for Vanguard)
	function updateSpread(inp: HTMLInputElement) {
		if (!inp.files || !inp.files[0]) return;
		const file = inp.files[0];
		if (file.type !== "application/pdf") {
			alert("Invalid file format. Please upload a PDF file.");
			setUploadResponse("Upload failed: Please upload a PDF file for Vanguard.");
			setUploadStatus("error");
			triggerErrorAnimation();
			inp.value = "";
			setFormData({ ...formData, spread: null });
			return;
		}
		const fiftyMB = 50 * 1024 * 1024;
		if (file.size > fiftyMB) {
			alert("Error processing PDF: file is too large (max 50 MB).");
			setUploadResponse(
				"Upload failed: PDF is too large (max 50 MB). Try compressing using an online tool like Smallpdf, iLovePDF, Adobe Acrobat, or PDF24, then re-upload."
			);
			setUploadStatus("error");
			triggerErrorAnimation();
			inp.value = "";
			setFormData({ ...formData, spread: null });
			return;
		}
		setFormData({ ...formData, spread: file });

		setSpreadData(URL.createObjectURL(file));
	}

	function updateMulti(e: ChangeEvent<HTMLInputElement>) {
		setFormData({ ...formData, multi: e.target.value });
	}

	// Attempt upload with retries (1 extra attempt). Returns response even on non-OK.
	async function attemptUpload(fd: FormData, retries = 1): Promise<{ response: Response; data: any }> {
		try {
			let response = await fetch("/api/upload", { method: "POST", body: fd });
			let contentType = response.headers.get("content-type") || "";

			let data;
			if (contentType.includes("application/json")) {
				try {
					data = await response.json();
				} catch (err) {
					console.error("Failed to parse JSON:", err);
					data = { message: "Invalid JSON response from server." };
				}
			} else {
				const text = await response.text();

				// If it's a common file-size error, throw something clear
				if (text.toLowerCase().includes("entity too large")) {
					throw new Error("Image is too large to upload. Try compressing or using a smaller image.");
				}

				// Fallback
				console.error("Unexpected text response:", text);
				throw new Error(text);
			}

			if (!response.ok) {
				if (retries > 0) return await attemptUpload(fd, retries - 1);
				// Return non-OK so caller can handle 413 (too large) differently.
				return { response, data };
			}

			return { response, data };
		} catch (error: any) {
			if (retries > 0) return await attemptUpload(fd, retries - 1);
			throw error;
		}
	}

	async function submitArticle(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setUploadResponse("Checking...");

		if (!formData.category) {
			setUploadResponse("Upload failed: You need to select a category.");
			setUploadStatus("error");
			triggerErrorAnimation();
			return;
		}
		if (!formData.title) {
			setUploadResponse("Upload failed: You need a title.");
			setUploadStatus("error");
			triggerErrorAnimation();
			return;
		}
		// For non-vanguard/multimedia, confirm missing fields
		if (formData.category !== "vanguard" && formData.category !== "multimedia") {
			if (!formData.img) {
				if (!window.confirm("No image uploaded. Proceed without an image?")) {
					setUploadResponse("Upload cancelled by user.");
					setUploadStatus("error");
					triggerErrorAnimation();
					return;
				}
			}
			if (!formData.authors) {
				if (!window.confirm("No author(s) provided. Proceed without author(s)?")) {
					setUploadResponse("Upload cancelled by user.");
					setUploadStatus("error");
					triggerErrorAnimation();
					return;
				}
			}
			if (!formData.content) {
				if (!window.confirm("No content provided. Proceed without article content?")) {
					setUploadResponse("Upload cancelled by user.");
					setUploadStatus("error");
					triggerErrorAnimation();
					return;
				}
			}
		}

		const fd = new FormData();
		fd.append("category", formData.category);
		const authors = formData.authors ? formData.authors.split(", ") : [""];

		// Include selected or current month/year
		const now = new Date();
		const chosenMonth = String(formData.month ?? now.getMonth() + 1);
		const chosenYear = String(formData.year ?? now.getFullYear());
		fd.append("month", chosenMonth);
		fd.append("year", chosenYear);

		// Send original image to server; server handles compression
		let preparedImg: File | null = formData.img ?? null;

		// Vanguard
		if (formData.category === "vanguard") {
			if (!formData.spread) {
				setUploadResponse("Upload failed: You need to upload a spread for Vanguard.");
				setUploadStatus("error");
				triggerErrorAnimation();
				return;
			}
			fd.append("spread", formData.spread);
			fd.append("title", formData.title);
		}
		// Multimedia
		else if (formData.category === "multimedia") {
			if (!formData.multi) {
				setUploadResponse("Upload failed: You need to submit a link.");
				setUploadStatus("error");
				triggerErrorAnimation();
				return;
			}
			fd.append("multi", formData.multi);
			if (!formData.subcategory || formData.subcategory === "") {
				setUploadResponse("Upload failed: You need to select a subcategory.");
				setUploadStatus("error");
				triggerErrorAnimation();
				return;
			}
			fd.append("subcategory", formData.subcategory);
			fd.append("title", formData.title);
		}
		// Everything else (standard article)
		else {
			fd.append("subcategory", formData.subcategory || formData.category);
			fd.append("title", formData.title);
			fd.append("authors", JSON.stringify(authors));
			if (formData.content) fd.append("content", formData.content);
			if (preparedImg) fd.append("img", preparedImg);
			// Append header info if provided
			if (formData.contentInfo) fd.append("content-info", formData.contentInfo);
		}

		setUploadResponse("Uploading; please stay on this page...");

		try {
			let { response, data } = await attemptUpload(fd, 1);

			// No special 413 handling; rely on server to accept originals

			if (!response.ok) {
				setUploadResponse(`Upload failed: ${data?.message || "Unknown error"}`);
				setUploadStatus("error");
				triggerErrorAnimation();
			} else {
				// Show server-compressed size if provided (adds after Original)
				if (data && typeof data.serverImgSizeBytes === "number" && data.serverImgSizeBytes > 0) {
					const fmt = (n: number) => {
						const units = ["B", "KB", "MB", "GB"] as const;
						let v = n;
						let i = 0;
						while (v >= 1024 && i < units.length - 1) {
							v /= 1024;
							i++;
						}
						return `${Math.round(v * 10) / 10} ${units[i]}`;
					};
					setUploadResponse(`${data.message || "Upload successful!"} (Server final size: ${fmt(data.serverImgSizeBytes)})`);
					setServerImgBytes(Number(data.serverImgSizeBytes));
				} else {
					setUploadResponse(data.message || "Upload successful!");
				}
				setUploadStatus("success");
				if (errorRef.current) errorRef.current.classList.remove("error-message");
				confetti();
				setFormData({});
				setPreviewContent("");
				localStorage.removeItem("uploadFormData");
				localStorage.removeItem("uploadFormTimestamp");
			}
		} catch (error: any) {
			console.error(error);
			setUploadResponse(`Upload failed: ${error.message || "Failed to upload"}`);
			setUploadStatus("error");
			triggerErrorAnimation();
		}
	}

	const inputImageDrop = (inpUpdate: Function, e: DragEvent<HTMLLabelElement>) => {
		e.preventDefault();
		e.currentTarget.classList.remove(styles["dragover"]);
		if (!e.currentTarget.parentNode) return;
		const parent = e.currentTarget.parentNode;
		const inp = parent.querySelector("input");
		const imName = parent.querySelector("span.img-name");
		if (!inp || !imName) return;
		inp.files = e.dataTransfer.files;
		inpUpdate(inp);
		if (!inp.files.length) {
			e.currentTarget.classList.remove(styles["has-file"]);
			return;
		}

		e.dataTransfer.files[0].name;

		e.currentTarget.classList.add(styles["has-file"]);
		imName.innerHTML = e.dataTransfer.files[0].name;
	};

	return (
		<div>
			<Head>
				<title>Upload Articles | The Tower</title>
				<meta property="og:title" content="Upload Articles | The Tower" />
				<meta property="og:description" content="Section editors upload content here." />
			</Head>

			<div id={styles.formWrapper}>
				<h2>PHS Tower Submission Platform</h2>
				<p>
					Upload articles for the next issue here. <strong>For editor use only.</strong>
				</p>
				<br />
				<form onSubmit={submitArticle}>
					<h3>Section</h3>
					<p>Please select your section/category.</p>
					<div id={styles.selectHolder}>
						<select id="cat" value={formData.category || ""} onChange={changeCategory}>
							<option value="">Select category</option>
							<option value="news-features">News & Features</option>
							<option value="opinions">Opinions</option>
							<option value="vanguard">Vanguard</option>
							<option value="arts-entertainment">Arts & Entertainment</option>
							<option value="sports">Sports</option>
							<option value="multimedia">Multimedia</option>
						</select>
						<div id={styles.subcats}>
							<select style={{ display: category === "" ? "inline" : "none" }} disabled onChange={changeSubcategory}>
								<option>Select subcategory</option>
							</select>
							{/* NEWS-FEATURES */}
							<select
								id="newfe-subcat"
								style={{ display: category === "news-features" ? "inline" : "none" }}
								value={formData.subcategory || ""}
								onChange={changeSubcategory}
							>
								<option value="">None</option>
								<option value="phs-profiles">PHS Profiles</option>
							</select>
							{/* OPINIONS */}
							<select
								id="ops-subcat"
								style={{ display: category === "opinions" ? "inline" : "none" }}
								value={formData.subcategory || ""}
								onChange={changeSubcategory}
							>
								<option value="">None</option>
								<option value="editorials">Editorials</option>
								<option value="cheers-jeers">Cheers & Jeers</option>
							</select>
							{/* ARTS & ENTERTAINMENT */}
							<select
								id="ae-subcat"
								style={{ display: category === "arts-entertainment" ? "inline" : "none" }}
								value={formData.subcategory || ""}
								onChange={changeSubcategory}
							>
								<option value="">None</option>
								<option value="student-artists">Student Artists</option>
							</select>
							{/* SPORTS */}
							<select
								id="sports-subcat"
								style={{ display: category === "sports" ? "inline" : "none" }}
								value={formData.subcategory || ""}
								onChange={changeSubcategory}
							>
								<option value="">None</option>
								<option value="student-athletes">Student Athletes</option>
							</select>
							{/* MULTIMEDIA */}
							<select
								id="multi-subcat"
								style={{ display: category === "multimedia" ? "inline" : "none" }}
								value={formData.subcategory || ""}
								onChange={changeSubcategory}
							>
								<option value="">Select subcategory</option>
								<option value="youtube">YouTube Video</option>
								<option value="podcast">Podcast</option>
							</select>
						</div>
					</div>
					<br />
					{/* Issue Date selection */}
					<h3>Issue Date</h3>
					<div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
						<label>
							Month
							<select value={(formData.month ?? new Date().getMonth() + 1).toString()} onChange={changeMonth}>
								<option value="1">January</option>
								<option value="2">February</option>
								<option value="3">March</option>
								<option value="4">April</option>
								<option value="5">May</option>
								<option value="6">June</option>
								<option value="7">July</option>
								<option value="8">August</option>
								<option value="9">September</option>
								<option value="10">October</option>
								<option value="11">November</option>
								<option value="12">December</option>
							</select>
						</label>
						<label>
							Year
							<input
								type="number"
								min={2010}
								max={new Date().getFullYear() + 1}
								value={String(formData.year ?? new Date().getFullYear())}
								onChange={changeYear}
							/>
						</label>
					</div>
					<hr />
					<br />

					<div className={styles["section-info"]} ref={containerRef}>
						<section className={styles["section-input"]}>
							{/* Standard Sections (non-Vanguard / non-Multimedia) */}
							<div
								id={styles["std-sections"]}
								style={{ display: category === "vanguard" || category === "multimedia" ? "none" : "block" }}
							>
								<h3>Article</h3>
								<p>
									<strong>Header image</strong> (JPG, JPEG, PNG, WEBP, or GIF only):
								</p>

								<div className={styles["file-input"]}>
									<label
										onDragEnter={e => {
											e.currentTarget.classList.add(styles["dragover"]);
										}}
										onDragLeave={e => {
											e.currentTarget.classList.remove(styles["dragover"]);
										}}
										onDragEnd={e => {
											e.currentTarget.classList.remove(styles["dragover"]);
										}}
										onDragOver={e => e.preventDefault()}
										onDrop={inputImageDrop.bind(globalThis, updateImage)}
									>
										<span className={styles["drop-img-prompt"]}>Drop Header Image Here (or click to upload)</span>
										<span className={styles["uploaded-prompt"]}>
											<i className="fa-solid fa-check"></i> <span className="img-name"></span> uploaded!
										</span>
										<input
											id="img-upload"
											type="file"
											accept=".jpg,.jpeg,.png,.gif,.webp"
											onChange={e => updateImage(e.target)}
										/>
									</label>
								</div>
								{imgOrigBytes !== null && (
									<p style={{ color: "#888", marginTop: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
										<button type="button" onClick={clearImage}>
											Clear
										</button>
										<span>
											Original size: {formatBytes(imgOrigBytes)}
											{serverImgBytes !== null
												? ` \u2192 Compressed: ${formatBytes(serverImgBytes)}`
												: " (will be compressed on upload)"}
										</span>
									</p>
								)}
								<br />
								<br />
								{/* If a header image is attached, show a resizable Header Info field */}
								{formData.img && (
									<>
										<strong>Header Info</strong>
										<p>
											Start with a label like <strong>Photo</strong>, <strong>Image</strong>, or <strong>Graphic</strong>,
											followed by a colon (<strong>:</strong>) and the name of the photographer or designer.
										</p>
										<p>
											To credit more than one person, include both names with <strong>and</strong> between them — for example:{" "}
											<strong>photo:</strong> John Doe and Jane Doe.
										</p>
										<p>
											Press <strong>Enter</strong> twice after the credit line to begin the context or description.
										</p>
										<textarea
											onChange={updateHeaderInfo}
											value={formData.contentInfo || ""}
											style={{ width: "100%", minHeight: "80px", resize: "block" }}
										/>
										<br />
										<br />
									</>
								)}
								<strong>Title</strong>
								<br />
								<input type="text" onChange={updateTitle} value={formData.title || ""} />
								<br />
								<br />

								{/* Hide entire authors block if category=opinions & subcategory=editorials */}
								{!(category === "opinions" && formData.subcategory === "editorials") && (
									<>
										<strong>Author(s)</strong>
										<p>Separate each author with a comma, and do not include titles. Leave this blank for the editorial.</p>
										<p>
											Example: &quot;John Doe, NEWS AND FEATURES CO-EDITOR and Jane Doe, OPINIONS CO-EDITOR&quot; is entered as
											&quot;John Doe, Jane Doe&quot;.
										</p>
										<input type="text" onChange={updateAuthors} value={formData.authors || ""} />
										<br />
										<br />
									</>
								)}

								<p>
									<strong>Article Content</strong> (Markdown supported).
									<br />
									Use empty lines to separate paragraphs. See{" "}
									<Link
										target="_blank"
										href="/articles/1970/1/news-features/Writing-in-Markdown-568"
										style={{ textDecoration: "underline" }}
									>
										this guide
									</Link>{" "}
									for details.
								</p>
								<textarea id={styles.contentInput} onChange={updateContent} value={formData.content || ""} />
								<br />
							</div>

							{/* Vanguard: requires a PDF spread */}
							<div id={styles.vanguard} style={{ display: category === "vanguard" ? "block" : "none" }}>
								<h3>Vanguard</h3>
								<p>
									<strong>Title</strong>
									<br />
									<input type="text" onChange={updateTitle} value={formData.title || ""} />
								</p>
								<br />
								<strong>Spread (PDF)</strong>
								<p>
									Please upload a single PDF with no special characters in the file name. If you have multiple pages, combine them
									into one PDF as it appears in the physical issue.
								</p>
								{/* <input type="file" accept=".pdf" onChange={updateSpread} /> */}
								<div className={styles["file-input"]}>
									<label
										onDragEnter={e => {
											e.currentTarget.classList.add(styles["dragover"]);
										}}
										onDragLeave={e => {
											e.currentTarget.classList.remove(styles["dragover"]);
										}}
										onDragEnd={e => {
											e.currentTarget.classList.remove(styles["dragover"]);
										}}
										onDragOver={e => e.preventDefault()}
										onDrop={inputImageDrop.bind(globalThis, updateSpread)}
									>
										<span className={styles["drop-img-prompt"]}>Drop Spread PDF Here (or click to upload)</span>
										<span className={styles["uploaded-prompt"]}>
											<i className="fa-solid fa-check"></i>
											<span className="img-name"></span> uploaded!
										</span>
										<input
											id="img-upload"
											type="file"
											accept=".jpg,.jpeg,.png,.gif,.webp"
											onChange={e => updateImage(e.target)}
										/>
										<input type="file" accept=".pdf" onChange={e => updateSpread(e.target)} />
									</label>
								</div>
							</div>

							{/* Multimedia: YouTube or Podcast */}
							<div id={styles.multimedia} style={{ display: category === "multimedia" ? "block" : "none" }}>
								{formData.subcategory === "youtube" ? (
									<>
										<h3>YouTube Video</h3>
										<strong>Title</strong>
										<br />
										<input type="text" onChange={updateTitle} value={formData.title || ""} />
										<br />
										<br />
										<p>
											Submit only the video ID (e.g. for https://www.youtube.com/watch?v=
											<b>TKfS5zVfGBc</b>).
										</p>
									</>
								) : formData.subcategory === "podcast" ? (
									<>
										<h3>Podcast</h3>
										<p>
											Submit only the part after e.g. https://rss.com/podcasts/
											<b>towershorts/1484378/</b>
										</p>
									</>
								) : (
									!formData.subcategory && <p>Please select “YouTube Video” or “Podcast”.</p>
								)}
								<input type="text" onChange={updateMulti} value={formData.multi || ""} />
							</div>
						</section>
						<div
							className={styles["splitter"]}
							onMouseDown={startDrag}
							role="separator"
							aria-orientation="vertical"
							aria-label="Resize preview"
						/>
						<section
							className={styles["section-preview"]}
							style={{
								flex: previewWidth !== null ? `0 0 ${Math.max(previewWidth, 0)}px` : undefined,
								width: previewWidth !== null ? `${Math.max(previewWidth, 0)}px` : undefined,
								minWidth: 0,
								overflow: "auto",
								display: previewWidth === 0 ? "none" : undefined,
							}}
						>
							{/* PREVIEW BLOCK */}
							<div style={{ textAlign: "left" }}>
								{formData.category && ["news-features", "opinions", "sports", "arts-entertainment"].includes(formData.category) && (
									<ArticleContent
										article={{
											id: -1,
											title: formData.title ? formData.title : "Enter title to update preview",
											content: previewContent
												? previewContent
												: formData.title
												? `<span style="color:gray">Enter content to update preview</i>`
												: "",
											published: false,
											category: formData.category ?? "",
											subcategory: formData.subcategory ?? "",
											authors: (formData.authors ?? "").split(", "),
											month: formData.month ?? new Date().getMonth() + 1,
											year: formData.year ?? new Date().getFullYear(),
											img: formData.imgData ? `${formData.imgData}` : "",
											markdown: true,
											contentInfo: formData.contentInfo,
										}}
									/>
								)}
								{formData.category === "vanguard" && (
									<SpreadContent
										spread={{
											id: -1,
											title: formData.title ?? "",
											src: spreadData,
											month: formData.month ?? new Date().getMonth() + 1,
											year: formData.year ?? new Date().getFullYear(),
											category: null,
										}}
									/>
								)}

								{formData.category === "multimedia" && formData.subcategory === "youtube" && (
									<>
										<h3 style={{ margin: "1rem" }}>Preview</h3>
										<div className="video-wrapper">
											<Video link={formData.multi ?? ""} title={formData.title ?? ""} />
											<br />
										</div>
									</>
								)}

								{formData.category === "multimedia" && formData.subcategory === "podcast" && (
									<>
										<h3 style={{ margin: "1rem" }}>Preview</h3>
										<Podcast link={formData.multi ?? ""} />
									</>
								)}

								{!formData.category && (
									<>
										<h3 style={{ margin: "1rem" }}>Select a Category!</h3>
									</>
								)}
							</div>
							<br /> <br /> <br />
						</section>
					</div>

					<br />
					<input type="submit" />
					<p id="bruh" ref={errorRef}>
						{uploadResponse}
					</p>
				</form>
			</div>

			<SavingIndicator uploadStatus={uploadStatus} isSaving={isSaving} />
		</div>
	);
}
