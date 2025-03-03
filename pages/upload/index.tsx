/** @format */

import Head from "next/head";
import { ChangeEvent, FormEvent, useState } from "react";
import Link from "next/link";
import styles from "./index.module.scss";
import { remark } from "remark";
import html from "remark-html";

export default function Upload() {
	type FormDataType = {
		category?: string | null | undefined;
		subcategory?: string | null | undefined;
		title?: string | null | undefined;
		authors?: string | null | undefined;
		content?: string | null | undefined;
		img?: File | null | undefined;
		spread?: File | null | undefined;
		multi?: string | null | undefined;
	};
	const [category, setCategory] = useState("");
	const [formData, setFormData] = useState<FormDataType>();
	const [uploadResponse, setUploadResponse] = useState("");
	const [previewDisplay, setPreviewDisplay] = useState("none");
	const [previewContent, setPreviewContent] = useState("");

	function changeCategory(event: ChangeEvent<HTMLSelectElement>) {
		setCategory(event.target.value);
		setFormData({ ...formData, category: event.target.value });
	}

	function changeSubcategory(event: ChangeEvent<HTMLSelectElement>) {
		setFormData({ ...formData, subcategory: event.target.value });
	}

	function updateTitle(event: ChangeEvent<HTMLInputElement>) {
		setFormData({ ...formData, title: event.target.value });
	}

	function updateAuthors(event: ChangeEvent<HTMLInputElement>) {
		setFormData({ ...formData, authors: event.target.value });
	}

	async function updateContent(event: ChangeEvent<HTMLTextAreaElement>) {
		setFormData({ ...formData, content: event.target.value });
		setPreviewContent((await remark().use(html).process(event.target.value)).toString());
	}

	function updateImage(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files ? event.target.files[0] : null;
		setFormData({ ...formData, img: file });
	}

	function updateSpread(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files ? event.target.files[0] : null;
		setFormData({ ...formData, spread: file });
	}

	function updateMulti(event: ChangeEvent<HTMLInputElement>) {
		setFormData({ ...formData, multi: event.target.value });
	}

	async function submitArticle(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setUploadResponse("Checking...");

		if (!formData) return;
		if (!formData.category) return setUploadResponse("You need to select a category.");

		let fd = new FormData();
		fd.append("category", formData.category);
		const authors = formData.authors ? formData.authors.split(", ") : [""];

		if (formData.category == "vanguard") {
			if (!formData.spread) return setUploadResponse("You need to upload a spread for Vanguard.");
			fd.append("spread", formData.spread);

			if (!formData.title) return setUploadResponse("You need a title.");
			fd.append("title", formData.title);
		} else if (formData.category == "multimedia") {
			if (!formData.multi) return setUploadResponse("You need to submit a link.");
			fd.append("multi", formData.multi);

			if (!formData.subcategory || formData.subcategory == "") return setUploadResponse("You need to select a subcategory.");
			fd.append("subcategory", formData.subcategory);

			if (formData.title == null || (formData.title == undefined && formData.subcategory == "youtube"))
				return setUploadResponse("You need a title.");
			else fd.append("title", formData.title);
		} else {
			if (!formData.title) return setUploadResponse("You need a title.");
			if (formData.subcategory) {
				fd.append("subcategory", formData.subcategory);
			} else {
				fd.append("subcategory", formData.category);
			}

			fd.append("title", formData.title);
			fd.append("authors", JSON.stringify(authors));
			if (formData.content) fd.append("content", formData.content);
			if (formData.img) fd.append("img", formData.img);
		}

		setUploadResponse("Uploading; please stay on this page...");
		const response = await fetch("/api/upload", {
			method: "POST",
			body: fd,
		});

		// Handle response if necessary
		response.json().then(data => {
			setUploadResponse(data.message);
			if (response.status == 200) {
				// Clear for next submission
				setFormData({});
				setPreviewContent("");
			}
		});
	}

	function togglePreview(event: FormEvent<HTMLInputElement>) {
		setPreviewDisplay(previewDisplay == "none" ? "block" : "none");
	}

	return (
		<div>
			<Head>
				<title>Upload Articles | The Tower</title>
				<meta property="og:title" content="Upload Articles | The Tower" />
				<meta property="og:description" content="Section editors upload content here." />
			</Head>
			<div id={styles.formWrapper}>
				<h2>PHS Tower Submission Platform</h2>
				<p>Upload articles for the next issue here. For editor use only.</p>
				<br />
				<form onSubmit={submitArticle}>
					<h3>Section</h3>
					<div id={styles.selectHolder}>
						<select id="cat" value={formData && formData.category ? formData.category : ""} onChange={changeCategory}>
							<option value="">Select category</option>
							<option value="news-features">News & Features</option>
							<option value="opinions">Opinions</option>
							<option value="vanguard">Vanguard</option>
							<option value="arts-entertainment">Arts & Entertainment</option>
							<option value="sports">Sports</option>
							<option value="multimedia">Multimedia</option>
						</select>
						<div id="subcats">
							<select style={{ display: category == "" ? "inline" : "none" }} disabled={true} onChange={changeSubcategory}>
								<option>Select subcategory</option>
							</select>
							<select
								id="newfe-subcat"
								style={{ display: category == "news-features" ? "inline" : "none" }}
								value={formData && formData.subcategory ? formData.subcategory : ""}
								onChange={changeSubcategory}
							>
								<option value="">None</option>
								<option value="phs-profiles">PHS Profiles</option>
							</select>
							<select
								id="ops-subcat"
								style={{ display: category == "opinions" ? "inline" : "none" }}
								value={formData && formData.subcategory ? formData.subcategory : ""}
								onChange={changeSubcategory}
							>
								<option value="">None</option>
								<option value="editorial">Editorials</option>
								<option value="cheers-jeers">Cheers & Jeers</option>
							</select>
							<select
								id="ae-subcat"
								style={{ display: category == "arts-entertainment" ? "inline" : "none" }}
								value={formData && formData.subcategory ? formData.subcategory : ""}
								onChange={changeSubcategory}
							>
								<option value="">None</option>
								<option value="student-artists">Student Artists</option>
							</select>
							<select
								id="sports-subcat"
								style={{ display: category == "sports" ? "inline" : "none" }}
								value={formData && formData.subcategory ? formData.subcategory : ""}
								onChange={changeSubcategory}
							>
								<option value="">None</option>
								<option value="student-athletes">Student Athletes</option>
							</select>
							<select
								id="multi-subcat"
								style={{ display: category == "multimedia" ? "inline" : "none" }}
								value={formData && formData.subcategory ? formData.subcategory : ""}
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

					<div id="std-sections" style={{ display: category == "vanguard" || category == "multimedia" ? "none" : "block" }}>
						<h3>Article</h3>
						<strong>Header image</strong>
						<br />
						<input type="file" accept="image/*" id="img" onChange={updateImage} />
						<br /> <br />
						<strong>Title</strong>
						<br />
						<input type="text" id="title" onChange={updateTitle} value={formData && formData.title ? formData.title : ""} />
						<br /> <br />
						<strong>Author</strong>
						<p>Separate each author with a comma, and do not include titles. Leave this blank for the editorial.</p>
						<p>
							Example: &quot;John Doe, NEWS AND FEATURES CO-EDITOR and Jane Doe, OPINIONS CO-EDITOR&quot; is entered as &quot;John Doe,
							Jane Doe&quot;.
						</p>
						<input type="text" id="authors" onChange={updateAuthors} value={formData && formData.authors ? formData.authors : ""} />
						<br /> <br />
						<p>
							You can write the article in Markdown (see{" "}
							<Link href="/articles/1970/1/news-features/Writing-in-Markdown-568" style={{ textDecoration: "underline" }}>
								here
							</Link>{" "}
							for more info). Format special notes as they appear on the physical paper.
							<strong> Separate paragraphs with empty lines (hit enter twice).</strong>
						</p>
						<textarea
							id={styles.contentInput}
							onChange={updateContent}
							value={formData && formData.content ? formData.content : ""}
						></textarea>
						<input type="checkbox" id="preview-checkbox" onChange={togglePreview} checked={previewDisplay == "block" ? true : false} />
						<label htmlFor="preview-checkbox">Show preview</label>
						<div style={{ display: previewDisplay }}>
							<hr />
							<div id={styles.preview} dangerouslySetInnerHTML={{ __html: previewContent }} />
							<hr />
						</div>
					</div>
					<div id="vanguard" style={{ display: category != "vanguard" ? "none" : "block" }}>
						<h3>Vanguard</h3>
						<strong>Title</strong>
						<br />
						<input type="text" id="title" onChange={updateTitle} value={formData && formData.title ? formData.title : ""} />
						<br /> <br />
						<strong>Spread</strong>
						<p>Upload your pages as one PDF (as they appear on the physical issue).</p>
						<input type="file" accept=".pdf" onChange={updateSpread} />
					</div>
					<div id="multimedia" style={{ display: category != "multimedia" ? "none" : "block" }}>
						{formData && formData.subcategory == "youtube" ? (
							<div id="yt">
								<h3>YouTube Video</h3>
								<strong>Title</strong>
								<br />
								<input type="text" id="title" onChange={updateTitle} value={formData && formData.title ? formData.title : ""} />
								<br /> <br />
								<p>
									Submit just the ID of the video (e.g. https://www.youtube.com/watch?v=
									<strong style={{ textDecoration: "underline" }}>TKfS5zVfGBc</strong>)
								</p>
							</div>
						) : (
							<div id="podcast">
								<h3>Podcast</h3>
								<p>
									Submit only podcast name and ID from the URL (e.g. https://rss.com/podcasts/
									<strong style={{ textDecoration: "underline" }}>towershorts/1484378/</strong>)
								</p>
							</div>
						)}
						<input type="text" onChange={updateMulti} />
					</div>
					<br />

					<input type="submit" />
					<p id="bruh">{uploadResponse}</p>
				</form>
			</div>
		</div>
	);
}
