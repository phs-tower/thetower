/** @format */

import Head from "next/head";
import { ChangeEvent, FormEvent, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { remark } from "remark";
import html from "remark-html";
import confetti from "canvas-confetti";
import imageCompression from "browser-image-compression";
import styles from "./index.module.scss";
import { displayDate } from "~/lib/utils";

// Utility: Convert data URL to File (if needed)
function dataURLtoFile(dataurl: string, filename: string): File {
	const arr = dataurl.split(",");
	const mimeMatch = arr[0].match(/:(.*?);/);
	if (!mimeMatch) throw new Error("Invalid data URL");
	const mime = mimeMatch[1];
	const bstr: any = atob(arr[1]);
	let n = bstr.length;
	const u8arr = new Uint8Array(n);
	while (n--) {
		u8arr[n] = bstr.charCodeAt(n);
	}
	return new File([u8arr], filename, { type: mime });
}

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
};

// 72 hours in ms
const THREE_DAYS_MS = 72 * 60 * 60 * 1000;

export default function Upload() {
	const [hydrated, setHydrated] = useState(false);
	const [monthYear, setMonthYear] = useState("");
	const [formData, setFormData] = useState<FormDataType>({});
	const [category, setCategory] = useState<string>("");
	const [uploadResponse, setUploadResponse] = useState("");
	const [previewDisplay, setPreviewDisplay] = useState("none");
	const [previewContent, setPreviewContent] = useState("");
	const [isCompressing, setIsCompressing] = useState(false);
	const [compressionSummary, setCompressionSummary] = useState<string | null>(null);

	const errorRef = useRef<HTMLParagraphElement>(null);

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
		if (compressionSummary) {
			const timer = setTimeout(() => setCompressionSummary(null), 4000);
			return () => clearTimeout(timer);
		}
	}, [compressionSummary]);

	useEffect(() => {
		setHydrated(true);
		setMonthYear(displayDate());

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
		const { category, subcategory, title, authors, content, multi, contentInfo } = formData;
		const fieldsToStore = { category, subcategory, title, authors, content, multi, contentInfo };
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

	async function updateContent(e: ChangeEvent<HTMLTextAreaElement>) {
		setFormData({ ...formData, content: e.target.value });
		const processed = await remark().use(html).process(e.target.value);
		setPreviewContent(processed.toString());
	}

	// New: Update Header Info from a resizable textarea
	function updateHeaderInfo(e: ChangeEvent<HTMLTextAreaElement>) {
		setFormData({ ...formData, contentInfo: e.target.value });
	}

	// Update image: Always compress to ~1MB (WebP). Accept only valid image types; max size 50 MB.
	async function updateImage(e: ChangeEvent<HTMLInputElement>) {
		if (!e.target.files || !e.target.files[0]) return;
		let original = e.target.files[0];

		const validExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
		const nameLower = original.name.toLowerCase();
		if (!validExtensions.some(ext => nameLower.endsWith(ext))) {
			alert("Invalid file format. Please select a JPG, JPEG, PNG, WEBP, or GIF file.");
			e.target.value = "";
			setFormData({ ...formData, img: null, imgData: null, imgName: null });
			return;
		}

		try {
			setIsCompressing(true);
			const originalSize = original.size;

			// Force a ~1MB target, WebP output for size efficiency
			const compressed = await imageCompression(original, {
				maxSizeMB: 1,
				maxWidthOrHeight: 2400,
				fileType: "image/webp",
				useWebWorker: true,
				initialQuality: 0.85,
			});

			const beforeMB = (originalSize / 1024 / 1024).toFixed(2);
			const afterMB = (compressed.size / 1024 / 1024).toFixed(2);
			setCompressionSummary(`Compressed: ${beforeMB}MB → ${afterMB}MB`);

			// Read compressed file as data URL for preview
			const reader = new FileReader();
			reader.onload = () => {
				setFormData({
					...formData,
					img: compressed,
					imgData: reader.result as string,
					imgName: original.name,
				});
			};
			reader.readAsDataURL(compressed);
		} catch (err) {
			console.warn("Image compression failed, using original:", err);

			// Fallback to original file if compression fails
			const reader = new FileReader();
			reader.onload = () => {
				setFormData({
					...formData,
					img: original,
					imgData: reader.result as string,
					imgName: original.name,
				});
			};
			reader.readAsDataURL(original);
		} finally {
			setIsCompressing(false);
		}
	}

	// Update PDF spread (for Vanguard)
	function updateSpread(e: ChangeEvent<HTMLInputElement>) {
		if (!e.target.files || !e.target.files[0]) return;
		const file = e.target.files[0];
		if (file.type !== "application/pdf") {
			alert("Invalid file format. Please upload a PDF file.");
			e.target.value = "";
			setFormData({ ...formData, spread: null });
			return;
		}
		const fiftyMB = 50 * 1024 * 1024;
		if (file.size > fiftyMB) {
			alert("Error processing PDF: file is too large (max 50 MB).");
			e.target.value = "";
			setFormData({ ...formData, spread: null });
			return;
		}
		setFormData({ ...formData, spread: file });
	}

	function updateMulti(e: ChangeEvent<HTMLInputElement>) {
		setFormData({ ...formData, multi: e.target.value });
	}

	// Attempt upload with retries (1 extra attempt)
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
				throw new Error(data.message || "Upload failed");
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
			if (formData.img) fd.append("img", formData.img);
			// Append header info if provided
			if (formData.contentInfo) fd.append("content-info", formData.contentInfo);
		}

		setUploadResponse("Uploading; please stay on this page...");

		try {
			let { response, data } = await attemptUpload(fd, 1);

			// If image upload returns 413 (Payload Too Large) and an image exists, try harder compression (~0.8MB)
			if (response.status === 413 && formData.img) {
				alert("Image too big! Retrying with stronger compression...");
				try {
					const harder = await imageCompression(formData.img, {
						maxSizeMB: 0.8,
						maxWidthOrHeight: 2000,
						fileType: "image/webp",
						useWebWorker: true,
						initialQuality: 0.8,
					});
					fd.set("img", harder);
					const attempt = await attemptUpload(fd, 1);
					response = attempt.response;
					data = attempt.data;
				} catch (compressionError: any) {
					console.warn("Second compression failed, retrying original:", compressionError);
					fd.set("img", formData.img);
					const attempt = await attemptUpload(fd, 1);
					response = attempt.response;
					data = attempt.data;
				}
			}

			if (!response.ok) {
				setUploadResponse(`Upload failed: ${data.message || "Unknown error"}`);
				setUploadStatus("error");
				triggerErrorAnimation();
			} else {
				setUploadResponse(data.message || "Upload successful!");
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

	function togglePreview() {
		setPreviewDisplay(previewDisplay === "none" ? "block" : "none");
	}

	return (
		<div>
			<Head>
				<title>Upload Articles | The Tower</title>
				<meta property="og:title" content="Upload Articles | The Tower" />
				<meta property="og:description" content="Section editors upload content here." />
			</Head>

			{(isCompressing || compressionSummary) && (
				<div
					style={{
						position: "fixed",
						top: "96px", // <-- was 20px; move below masthead OR keep 20px
						right: "20px",
						backgroundColor: "#333",
						color: "white",
						padding: "10px 20px",
						borderRadius: "8px",
						boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
						zIndex: 100000000001, // <-- bump above your nav
						animation: "fadeIn 0.3s ease",
						fontSize: "1rem",
					}}
				>
					{isCompressing ? "Compressing image..." : compressionSummary}
				</div>
			)}

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
					<hr />
					<br />

					{/* Standard Sections (non-Vanguard / non-Multimedia) */}
					<div id={styles["std-sections"]} style={{ display: category === "vanguard" || category === "multimedia" ? "none" : "block" }}>
						<h3>Article</h3>
						<p>
							<strong>Header image</strong> (JPG, JPEG, PNG, WEBP, or GIF only):
						</p>
						<input type="file" accept=".jpg,.jpeg,.png,.gif,.webp" onChange={updateImage} />
						<br />
						<br />
						{/* If a header image is attached, show a resizable Header Info field */}
						{formData.img && (
							<>
								<strong>Header Info</strong>
								<p>
									Start with a label like <strong>Photo</strong>, <strong>Image</strong>, or <strong>Graphic</strong>, followed by a
									colon (<strong>:</strong>) and the name of the photographer or designer.
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
									style={{ width: "100%", minHeight: "80px", resize: "both" }}
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
							<Link href="/articles/1970/1/news-features/Writing-in-Markdown-568" style={{ textDecoration: "underline" }}>
								this guide
							</Link>{" "}
							for details.
						</p>
						<textarea id={styles.contentInput} onChange={updateContent} value={formData.content || ""} />
						<br />

						<input type="checkbox" onChange={togglePreview} checked={previewDisplay === "block"} />
						<label>Show Preview</label>

						{/* PREVIEW BLOCK */}
						<div style={{ display: previewDisplay, textAlign: "left" }}>
							<hr />

							{/* Title */}
							{formData.title && (
								<h1
									style={{
										fontFamily: "Minion Pro Medium, Courier New",
										fontSize: "2.5rem",
										fontWeight: "bold",
										textAlign: "center",
										marginBottom: "0.1rem",
									}}
								>
									{formData.title}
								</h1>
							)}

							{/* Month/Year */}
							{monthYear && (
								<p
									style={{
										fontFamily: "Neue Montreal Regular",
										fontSize: "1.6rem",
										color: "#8b8b8b",
										marginBottom:
											formData.authors && !(category === "opinions" && formData.subcategory === "editorials")
												? "0.3rem"
												: "1.25rem",
										textAlign: "center",
									}}
								>
									{monthYear}
								</p>
							)}

							{/* Authors Preview */}
							{formData.authors && !(category === "opinions" && formData.subcategory === "editorials") && (
								<div
									style={{
										fontFamily: "Neue Montreal Regular",
										fontSize: "1rem",
										color: "#8b8b8b",
										marginBottom: "1rem",
										textAlign: "center",
									}}
								>
									{formData.authors.split(", ").map((author, i, arr) => (
										<span
											key={i}
											style={{
												fontFamily: "Neue Montreal Regular",
												fontSize: "1rem",
												color: "#8b8b8b",
											}}
										>
											{author}
											{i < arr.length - 1 && (
												<span
													style={{
														fontFamily: "Neue Montreal Regular",
														fontSize: "1rem",
														color: "#8b8b8b",
														margin: "0 0.25rem",
													}}
												>
													•
												</span>
											)}
										</span>
									))}
								</div>
							)}

							<div id={styles.preview} dangerouslySetInnerHTML={{ __html: previewContent }} />
							<hr />
						</div>
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
							Please upload a single PDF with no special characters in the file name. If you have multiple pages, combine them into one
							PDF as it appears in the physical issue.
						</p>
						<input type="file" accept=".pdf" onChange={updateSpread} />
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

					<br />
					<input type="submit" />
					<p id="bruh" ref={errorRef}>
						{uploadResponse}
					</p>
				</form>
			</div>

			{/* Saving Indicator at Bottom Right */}
			<div
				style={{
					position: "fixed",
					bottom: "10px",
					right: "10px",
					textAlign: "right",
				}}
			>
				<span className={`upload-status ${uploadStatus}`} style={{ fontSize: "1.6rem", transition: "color 2s ease" }}>
					{isSaving ? (
						<>
							Saving...
							<span
								style={{
									display: "inline-block",
									width: "16px",
									height: "16px",
									border: "2px solid red",
									borderTop: "2px solid transparent",
									borderRadius: "50%",
									marginLeft: "8px",
									animation: "spin 1s linear infinite",
								}}
							/>
						</>
					) : (
						"Saved!"
					)}
				</span>
				<br />
				<span style={{ fontSize: ".6rem", color: "#8b8b8b" }}>(Saves are stored for a maximum of 3 days)</span>
			</div>

			{/* Keyframes for spinner and error animation */}
			<style jsx>{`
				@keyframes spin {
					0% {
						transform: rotate(0deg);
					}
					100% {
						transform: rotate(360deg);
					}
				}
				.error-message {
					color: red;
					animation: shake 0.5s;
				}
				@keyframes shake {
					0% {
						transform: translate(0px);
					}
					25% {
						transform: translate(-5px);
					}
					50% {
						transform: translate(5px);
					}
					75% {
						transform: translate(-5px);
					}
					100% {
						transform: translate(0px);
					}
				}
				.upload-status.normal {
					color: #8b8b8b;
				}
				.upload-status.success {
					color: green;
				}
				.upload-status.error {
					color: red;
				}
			`}</style>
		</div>
	);
}
