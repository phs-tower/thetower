/** @format */

import Head from "next/head";
import { ChangeEvent, FormEvent, useEffect, useState, useRef, DragEvent } from "react";
import Link from "next/link";
import { remark } from "remark";
import html from "remark-html";
import confetti from "canvas-confetti";
import { article, spreads } from "@prisma/client";
import styles from "./upload.module.scss";
import { ArticleContent } from "../articles/[year]/[month]/[cat]/[slug]";
import dynamic from "next/dynamic";
import SpreadGallery from "~/components/spreadgallery.client";
import { getSpreadPageImageUrl, inferVanguardPageFromImageUrl, parseSpreadSource } from "~/lib/utils";
import { getPdfJs } from "~/lib/pdfjs-client";

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
	vanguardPageNumber?: number | null;
};

type UploadListItem = Pick<article, "id" | "title" | "category" | "subcategory" | "published" | "month" | "year">;

// 72 hours in ms
const THREE_DAYS_MS = 72 * 60 * 60 * 1000;
const VALID_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif"];
const HEIC_EXTENSIONS = [".heic", ".heif"];
const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function hasAllowedImageExtension(fileName: string) {
	const lowerName = fileName.toLowerCase();
	return VALID_IMAGE_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}

function isHeicLike(fileName: string) {
	const lowerName = fileName.toLowerCase();
	return HEIC_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}

function normalizeVanguardSubcategory(subcategory?: string | null) {
	return subcategory === "random-musings" ? "articles" : subcategory;
}

function SavingIndicator({ uploadStatus, isSaving }: { uploadStatus: string; isSaving: boolean }) {
	return (
		<div className={styles["save-indicator"]}>
			<span className={`${styles["upload-status"]} ${styles[uploadStatus]}`}>
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
			<span className={styles["save-info"]}>(Saves are stored for a maximum of 3 days)</span>
		</div>
	);
}

export default function Upload() {
	const [hydrated, setHydrated] = useState(false);
	const [formData, setFormData] = useState<FormDataType>({});
	const [category, setCategory] = useState<string>("");
	const [uploadResponse, setUploadResponse] = useState("");
	const [previewContent, setPreviewContent] = useState("");
	const [spreadPageAssets, setSpreadPageAssets] = useState<File[]>([]);
	const [spreadPreviewUrls, setSpreadPreviewUrls] = useState<string[]>([]);
	const [imgOrigBytes, setImgOrigBytes] = useState<number | null>(null);
	const [serverImgBytes, setServerImgBytes] = useState<number | null>(null);
	const [issueArticles, setIssueArticles] = useState<UploadListItem[]>([]);
	const [issueArticlesLoading, setIssueArticlesLoading] = useState(false);
	const [loadingArticleId, setLoadingArticleId] = useState<number | null>(null);
	const [deletingDraft, setDeletingDraft] = useState(false);
	const [editingArticleId, setEditingArticleId] = useState<number | null>(null);
	const [issueVanguardSpread, setIssueVanguardSpread] = useState<spreads | null | undefined>(undefined);
	const [issueVanguardSpreadLoading, setIssueVanguardSpreadLoading] = useState(false);

	const selectedMonth = formData.month ?? new Date().getMonth() + 1;
	const selectedYear = formData.year ?? new Date().getFullYear();
	const filteredIssueArticles = category
		? issueArticles.filter(item => {
				if (item.category !== category) return false;
				if (category === "vanguard" && formData.subcategory && formData.subcategory !== "spreads") {
					if (formData.subcategory === "articles") {
						return item.subcategory === "articles" || item.subcategory === "random-musings";
					}
					return item.subcategory === formData.subcategory;
				}
				return true;
		  })
		: issueArticles;

	const errorRef = useRef<HTMLParagraphElement>(null);
	const spreadPreviewUrlsRef = useRef<string[]>([]);

	// Resizable preview panel
	const containerRef = useRef<HTMLDivElement>(null);
	const [dragging, setDragging] = useState(false);
	const [previewWidth, setPreviewWidth] = useState<number | null>(null); // px; 0 => hidden

	const isVanguardSpread = category === "vanguard" && (formData.subcategory || "spreads") === "spreads";
	const isVanguardArticle = category === "vanguard" && formData.subcategory === "articles";
	const isArticleLikeSection = Boolean(category && category !== "multimedia" && !isVanguardSpread);
	const usesExistingVanguardSpreadImage =
		isVanguardArticle && !formData.img && inferVanguardPageFromImageUrl(formData.imgData ?? undefined) !== null;
	const hasManualHeaderImage = Boolean(formData.img || (formData.imgData && !usesExistingVanguardSpreadImage));
	const needsManualHeaderImage = isArticleLikeSection;
	const selectedVanguardPageNumber =
		isVanguardArticle && formData.vanguardPageNumber && formData.vanguardPageNumber > 0 ? formData.vanguardPageNumber : null;
	const issueVanguardSpreadPageCount = issueVanguardSpread ? parseSpreadSource(issueVanguardSpread.src).pageCount : 0;
	const selectedVanguardPagePreview =
		selectedVanguardPageNumber &&
		!hasManualHeaderImage &&
		issueVanguardSpread &&
		(!issueVanguardSpreadPageCount || selectedVanguardPageNumber <= issueVanguardSpreadPageCount)
			? getSpreadPageImageUrl(issueVanguardSpread.src, selectedVanguardPageNumber)
			: "";
	const showMissingVanguardSpreadWarning =
		isVanguardArticle &&
		!hasManualHeaderImage &&
		Boolean(selectedVanguardPageNumber) &&
		!issueVanguardSpreadLoading &&
		issueVanguardSpread === null;
	const articlePreviewImage =
		isVanguardArticle && !hasManualHeaderImage
			? selectedVanguardPagePreview ||
			  (selectedVanguardPageNumber
					? issueVanguardSpreadLoading || issueVanguardSpread === undefined
						? formData.imgData || ""
						: ""
					: formData.imgData || "")
			: formData.imgData || "";

	useEffect(() => {
		return () => {
			spreadPreviewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
		};
	}, []);

	useEffect(() => {
		if (!hydrated) return;
		// Load saved width or set a sensible default based on container width
		const saved = localStorage.getItem("uploadPreviewWidthPx");
		let initial: number | null = null;
		if (saved && !Number.isNaN(Number(saved))) initial = Math.max(0, parseInt(saved, 10));
		if (initial === null || Number.isNaN(initial)) {
			const el = containerRef.current;
			if (!el) return;

			const rect = el.getBoundingClientRect();
			initial = Math.round(Math.min(Math.max(rect.width * 0.4, 320), 720));
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
			// Do not load persisted month/year; always default to latest
			const { month: _ignoredMonth, year: _ignoredYear, ...rest } = loaded || {};
			const normalizedRest = rest?.category === "vanguard" ? { ...rest, subcategory: normalizeVanguardSubcategory(rest.subcategory) } : rest;
			setFormData(normalizedRest);
			if (normalizedRest?.category) setCategory(normalizedRest.category);
		} else {
			localStorage.removeItem("uploadFormData");
			localStorage.removeItem("uploadFormTimestamp");
		}
	}, []);

	// Save to localStorage on every update
	useEffect(() => {
		if (!hydrated) return;
		setIsSaving(true);
		// Persist core fields only; month/year should not be saved
		const { category, subcategory, title, authors, content, multi, contentInfo, vanguardPageNumber } = formData;
		const fieldsToStore = { category, subcategory, title, authors, content, multi, contentInfo, vanguardPageNumber };
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

	useEffect(() => {
		if (!hydrated) return;
		void refreshIssueArticles(selectedMonth, selectedYear);
	}, [hydrated, selectedMonth, selectedYear]);

	useEffect(() => {
		if (!hydrated || !isVanguardArticle) {
			setIssueVanguardSpread(undefined);
			setIssueVanguardSpreadLoading(false);
			return;
		}

		let cancelled = false;

		async function loadIssueVanguardSpread() {
			setIssueVanguardSpread(undefined);
			setIssueVanguardSpreadLoading(true);
			try {
				const response = await fetch("/api/load/spread-by-issue", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ category: "vanguard", month: selectedMonth, year: selectedYear }),
				});
				const data = await response.json();
				if (!response.ok) throw new Error(data?.message || "Could not load the Vanguard spread for this issue.");
				if (!cancelled) setIssueVanguardSpread(data ?? null);
			} catch (error) {
				console.error(error);
				if (!cancelled) setIssueVanguardSpread(null);
			} finally {
				if (!cancelled) setIssueVanguardSpreadLoading(false);
			}
		}

		void loadIssueVanguardSpread();

		return () => {
			cancelled = true;
		};
	}, [hydrated, isVanguardArticle, selectedMonth, selectedYear]);

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

	function replaceSpreadPreviewUrls(urls: string[]) {
		spreadPreviewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
		spreadPreviewUrlsRef.current = urls;
		setSpreadPreviewUrls(urls);
	}

	function setFileInputVisualState(inp: HTMLInputElement) {
		const label = inp.parentElement;
		const fileName = inp.files?.[0]?.name ?? "";
		const nameTarget = label?.querySelector("span.img-name");

		if (nameTarget) nameTarget.textContent = fileName;
		if (label) {
			if (fileName) label.classList.add(styles["has-file"]);
			else label.classList.remove(styles["has-file"]);
		}
	}

	async function buildPdfPreviewImages(source: File) {
		const pdfjs = await getPdfJs();
		const loadingTask = pdfjs.getDocument({ data: await source.arrayBuffer(), disableWorker: true } as any);
		const pdf = await loadingTask.promise;
		const pageFiles: File[] = [];
		const previewUrls: string[] = [];

		for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
			const page = await pdf.getPage(pageNumber);
			const viewport = page.getViewport({ scale: 1.8 });
			const canvas = document.createElement("canvas");
			const context = canvas.getContext("2d");
			if (!context) throw new Error("Could not create a canvas context for this PDF preview.");

			canvas.width = Math.ceil(viewport.width);
			canvas.height = Math.ceil(viewport.height);

			await page.render({ canvasContext: context as any, viewport } as any).promise;

			const blob = await new Promise<Blob>((resolve, reject) => {
				canvas.toBlob(result => {
					if (result) resolve(result);
					else reject(new Error("Could not convert the Vanguard spread page into an image."));
				}, "image/png");
			});

			page.cleanup();

			const imageFile = new File([blob], `${source.name.replace(/\.pdf$/i, "")}-page-${pageNumber}.png`, {
				type: "image/png",
				lastModified: Date.now(),
			});
			pageFiles.push(imageFile);
			previewUrls.push(URL.createObjectURL(blob));
		}

		await loadingTask.destroy();
		return { pageFiles, previewUrls, pageCount: pdf.numPages };
	}

	async function convertHeicToPng(source: File): Promise<File> {
		const fd = new FormData();
		fd.append("img", source);
		const response = await fetch("/api/upload/convert-image", {
			method: "POST",
			body: fd,
		});
		if (!response.ok) {
			let msg = "Could not convert HEIC image.";
			try {
				const data = await response.json();
				msg = data?.message || msg;
			} catch {}
			throw new Error(msg);
		}
		const converted = await response.blob();
		const outName = source.name.replace(/\.(heic|heif)$/i, ".png");
		return new File([converted], outName, { type: "image/png", lastModified: Date.now() });
	}

	async function refreshIssueArticles(month: number, year: number) {
		setIssueArticlesLoading(true);
		try {
			const response = await fetch("/api/load/articles-by-issue", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ month, year }),
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data?.message || "Could not load uploaded articles.");
			setIssueArticles(Array.isArray(data) ? data : []);
		} catch (error) {
			console.error(error);
			setIssueArticles([]);
		} finally {
			setIssueArticlesLoading(false);
		}
	}

	async function loadArticleForEditing(id: number) {
		setLoadingArticleId(id);
		try {
			const response = await fetch("/api/load/article-by-id", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id }),
			});
			const loaded = (await response.json()) as article & { message?: string };
			if (!response.ok) throw new Error(loaded?.message || "Could not load this article.");
			if (loaded.published) throw new Error("Published articles are locked and cannot be edited here.");
			const normalizedSubcategory = loaded.category === "vanguard" ? normalizeVanguardSubcategory(loaded.subcategory) : loaded.subcategory;

			setEditingArticleId(loaded.id);
			setCategory(loaded.category);
			setFormData({
				category: loaded.category,
				subcategory: normalizedSubcategory,
				title: loaded.title,
				authors: loaded.authors.join(", "),
				content: loaded.content,
				contentInfo: loaded.contentInfo ?? "",
				img: null,
				spread: null,
				imgData: loaded.img || null,
				imgName: loaded.img ? "existing image" : null,
				multi: null,
				month: loaded.month,
				year: loaded.year,
				vanguardPageNumber:
					loaded.category === "vanguard" && normalizedSubcategory === "articles" ? inferVanguardPageFromImageUrl(loaded.img) : null,
			});
			setImgOrigBytes(null);
			setServerImgBytes(null);
			replaceSpreadPreviewUrls([]);
			setSpreadPageAssets([]);
			setUploadResponse(`Loaded "${loaded.title}" for editing.`);
		} catch (error: any) {
			console.error(error);
			setUploadResponse(`Failed to load article: ${error?.message || "Unknown error"}`);
			setUploadStatus("error");
			triggerErrorAnimation();
		} finally {
			setLoadingArticleId(null);
		}
	}

	async function deleteLoadedDraft() {
		if (editingArticleId === null) return;
		if (!window.confirm("Delete this draft permanently? This cannot be undone.")) return;

		setDeletingDraft(true);
		try {
			const response = await fetch("/api/upload/delete-draft", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: editingArticleId }),
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data?.message || "Failed to delete draft.");

			const month = formData.month ?? new Date().getMonth() + 1;
			const year = formData.year ?? new Date().getFullYear();
			clearEditingState();
			setUploadResponse(data.message || "Draft deleted.");
			setUploadStatus("success");
			void refreshIssueArticles(month, year);
		} catch (error: any) {
			console.error(error);
			setUploadResponse(`Failed to delete draft: ${error?.message || "Unknown error"}`);
			setUploadStatus("error");
			triggerErrorAnimation();
		} finally {
			setDeletingDraft(false);
		}
	}

	function clearEditingState() {
		setEditingArticleId(null);
		setCategory("");
		setIssueVanguardSpread(undefined);
		setIssueVanguardSpreadLoading(false);
		setFormData({
			month: selectedMonth,
			year: selectedYear,
		});
		setPreviewContent("");
		replaceSpreadPreviewUrls([]);
		setSpreadPageAssets([]);
		setImgOrigBytes(null);
		setServerImgBytes(null);
	}

	function changeCategory(e: ChangeEvent<HTMLSelectElement>) {
		const nextCategory = e.target.value;
		const nextSubcategory =
			nextCategory === "vanguard"
				? formData.category === "vanguard" && formData.subcategory
					? normalizeVanguardSubcategory(formData.subcategory)
					: "spreads"
				: nextCategory === "multimedia"
				? formData.subcategory === "youtube" || formData.subcategory === "podcast"
					? formData.subcategory
					: ""
				: formData.subcategory;

		setCategory(nextCategory);
		setFormData({
			...formData,
			category: nextCategory,
			subcategory: nextSubcategory,
			vanguardPageNumber: nextCategory === "vanguard" && nextSubcategory === "articles" ? formData.vanguardPageNumber : null,
		});
		if (nextCategory !== "vanguard" || nextSubcategory !== "spreads") {
			replaceSpreadPreviewUrls([]);
			setSpreadPageAssets([]);
		}
	}

	function changeSubcategory(e: ChangeEvent<HTMLSelectElement>) {
		const nextSubcategory = e.target.value;
		setFormData({
			...formData,
			subcategory: nextSubcategory,
			spread: nextSubcategory === "spreads" ? formData.spread : null,
			vanguardPageNumber: nextSubcategory === "articles" ? formData.vanguardPageNumber : null,
		});
		if (category === "vanguard" && nextSubcategory !== "spreads") {
			replaceSpreadPreviewUrls([]);
			setSpreadPageAssets([]);
		}
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

	function updateVanguardPageNumber(e: ChangeEvent<HTMLInputElement>) {
		const value = parseInt(e.target.value, 10);
		setFormData({ ...formData, vanguardPageNumber: !isNaN(value) ? value : null });
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

		if (!hasAllowedImageExtension(image.name)) {
			alert("Invalid file format. Please select a JPG, JPEG, PNG, WEBP, GIF, HEIC, or HEIF file.");
			inp.value = "";
			setFormData({ ...formData, img: null, imgData: null, imgName: null });
			setFileInputVisualState(inp);
			return;
		}

		// Track original size and preview the original (no client compression)
		setImgOrigBytes(image.size);

		if (isHeicLike(image.name)) {
			try {
				setUploadResponse("Converting HEIC/HEIF to PNG for preview...");
				image = await convertHeicToPng(image);
			} catch (error: any) {
				setUploadResponse(`Image conversion failed: ${error?.message || "Could not convert HEIC/HEIF."}`);
				setUploadStatus("error");
				triggerErrorAnimation();
				inp.value = "";
				setFormData({ ...formData, img: null, imgData: null, imgName: null });
				setFileInputVisualState(inp);
				return;
			}
		}

		const reader = new FileReader();
		reader.onload = () => {
			setFormData(prev => ({
				...prev,
				img: image,
				imgData: reader.result as string,
				imgName: image.name,
			}));
		};
		reader.readAsDataURL(image);
		setFileInputVisualState(inp);
	}

	function clearImage() {
		setFormData({ ...formData, img: null, imgData: null, imgName: null });
		setImgOrigBytes(null);
		setServerImgBytes(null);
		const inp = document.getElementById("article-img-upload") as HTMLInputElement | null;
		if (inp) {
			inp.value = "";
			setFileInputVisualState(inp);
		}
	}

	// Update PDF spread (for Vanguard)
	async function updateSpread(inp: HTMLInputElement) {
		if (!inp.files || !inp.files[0]) return;
		const file = inp.files[0];
		if (file.type !== "application/pdf") {
			alert("Invalid file format. Please upload a PDF file.");
			setUploadResponse("Upload failed: Please upload a PDF file for Vanguard.");
			setUploadStatus("error");
			triggerErrorAnimation();
			inp.value = "";
			setFormData({ ...formData, spread: null });
			setFileInputVisualState(inp);
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
			setFileInputVisualState(inp);
			return;
		}

		try {
			setUploadResponse("Converting Vanguard spread PDF into page images...");
			const { pageFiles, previewUrls } = await buildPdfPreviewImages(file);
			setFormData(prev => ({ ...prev, spread: file }));
			setSpreadPageAssets(pageFiles);
			replaceSpreadPreviewUrls(previewUrls);
			setFileInputVisualState(inp);
			setUploadResponse(`Prepared ${pageFiles.length} Vanguard spread page${pageFiles.length === 1 ? "" : "s"} for upload.`);
		} catch (error: any) {
			console.error(error);
			inp.value = "";
			setFormData(prev => ({ ...prev, spread: null }));
			setSpreadPageAssets([]);
			replaceSpreadPreviewUrls([]);
			setFileInputVisualState(inp);
			setUploadResponse(`Upload failed: ${error?.message || "Could not process the Vanguard PDF."}`);
			setUploadStatus("error");
			triggerErrorAnimation();
		}
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
		const hasLinkedImage = Boolean(formData.imgData && formData.imgData.trim() !== "");
		const hasVanguardImageSource = Boolean(formData.img || hasLinkedImage || (formData.vanguardPageNumber && formData.vanguardPageNumber > 0));
		const hasImage = isVanguardArticle ? hasVanguardImageSource : Boolean(formData.img || hasLinkedImage);
		if (isVanguardArticle && !hasVanguardImageSource) {
			setUploadResponse("Upload failed: choose a Vanguard spread page or upload a custom image for this article.");
			setUploadStatus("error");
			triggerErrorAnimation();
			return;
		}
		if (isVanguardSpread && (!formData.spread || spreadPageAssets.length === 0)) {
			setUploadResponse("Upload failed: upload the Vanguard spread PDF so the page images can be generated.");
			setUploadStatus("error");
			triggerErrorAnimation();
			return;
		}
		// For article-style uploads, confirm missing fields
		if (isArticleLikeSection) {
			if (!hasImage) {
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
		if (editingArticleId !== null) fd.append("article-id", String(editingArticleId));

		// Send original image to server; server handles compression
		let preparedImg: File | null = isVanguardArticle ? null : formData.img ?? null;

		// Vanguard
		if (isVanguardSpread) {
			if (!formData.spread) {
				setUploadResponse("Upload failed: You need to upload a spread PDF for Vanguard.");
				setUploadStatus("error");
				triggerErrorAnimation();
				return;
			}
			fd.append("subcategory", "spreads");
			fd.append("spread", formData.spread);
			fd.append("spread-page-count", String(spreadPageAssets.length));
			spreadPageAssets.forEach((pageFile, index) => {
				fd.append(`spread-page-${index + 1}`, pageFile);
			});
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
			else if (editingArticleId !== null) fd.append("existing-img", formData.imgData ? String(formData.imgData) : "");
			// Append header info if provided
			if (formData.contentInfo) fd.append("content-info", formData.contentInfo);
			if (isVanguardArticle && formData.vanguardPageNumber) fd.append("vanguard-page-number", String(formData.vanguardPageNumber));
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
				clearEditingState();
				localStorage.removeItem("uploadFormData");
				localStorage.removeItem("uploadFormTimestamp");
				void refreshIssueArticles(Number(chosenMonth), Number(chosenYear));
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
				<p className={styles["editor-note"]}>★Editors should upload their best article first!</p>
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
							<select style={{ display: !category ? "inline" : "none" }} disabled onChange={changeSubcategory}>
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
							<select
								id="vanguard-subcat"
								style={{ display: category === "vanguard" ? "inline" : "none" }}
								value={formData.subcategory || "spreads"}
								onChange={changeSubcategory}
							>
								<option value="spreads">Spread PDF</option>
								<option value="articles">Articles</option>
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
					<div className={styles["issue-date"]}>
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
							<div id={styles["std-sections"]} style={{ display: isArticleLikeSection ? "block" : "none" }}>
								<h3>{category === "vanguard" ? "Vanguard Article" : "Article"}</h3>
								{isVanguardArticle && (
									<>
										<p className={styles["vanguard-note"]}>
											Upload the issue spread PDF first if this article should use one of the spread pages as its image. You can
											also upload a custom header image here instead. If both are provided, the custom image wins.
										</p>
										<label className={styles["vanguard-page-field"]}>
											<strong>Spread page number</strong>
											<input
												type="number"
												min={1}
												step={1}
												value={formData.vanguardPageNumber ? String(formData.vanguardPageNumber) : ""}
												onChange={updateVanguardPageNumber}
											/>
										</label>
										{showMissingVanguardSpreadWarning && (
											<p className={styles["vanguard-warning"]}>
												Spread does not exist for {MONTH_NAMES[selectedMonth]} {selectedYear}
											</p>
										)}
										<br />
										<br />
									</>
								)}

								{needsManualHeaderImage && (
									<>
										<p>
											<strong>{isVanguardArticle ? "Custom header image" : "Header image"}</strong>{" "}
											{isVanguardArticle
												? "(optional; JPG, JPEG, PNG, WEBP, GIF, HEIC, or HEIF):"
												: "(JPG, JPEG, PNG, WEBP, GIF, HEIC, or HEIF):"}
										</p>

										<div className={styles["file-input"]}>
											<label
												onDragEnter={e => e.currentTarget.classList.add(styles["dragover"])}
												onDragLeave={e => e.currentTarget.classList.remove(styles["dragover"])}
												onDragEnd={e => e.currentTarget.classList.remove(styles["dragover"])}
												onDragOver={e => e.preventDefault()}
												onDrop={inputImageDrop.bind(globalThis, updateImage)}
											>
												<span className={styles["drop-img-prompt"]}>
													{isVanguardArticle
														? "Drop Custom Header Image Here (or click to upload)"
														: "Drop Header Image Here (or click to upload)"}
												</span>
												<span className={styles["uploaded-prompt"]}>
													<i className="fa-solid fa-check"></i> <span className="img-name"></span> uploaded!
												</span>
												<input
													id="article-img-upload"
													type="file"
													accept=".jpg,.jpeg,.png,.gif,.webp,.heic,.heif"
													onChange={e => updateImage(e.target)}
												/>
											</label>
										</div>
										{imgOrigBytes !== null && (
											<p className={styles["compression-summary"]}>
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
									</>
								)}

								{needsManualHeaderImage && hasManualHeaderImage && (
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
									<Link target="_blank" href="/articles/1970/1/news-features/Writing-in-Markdown-568">
										this guide
									</Link>{" "}
									for details.
								</p>
								<textarea id={styles.contentInput} onChange={updateContent} value={formData.content || ""} />
								<br />
							</div>

							<div id={styles.vanguard} style={{ display: isVanguardSpread ? "block" : "none" }}>
								<h3>Vanguard Spread</h3>
								<p>
									<strong>Title</strong>
									<br />
									<input type="text" onChange={updateTitle} value={formData.title || ""} />
								</p>
								<br />
								<strong>Spread (PDF)</strong>
								<p>
									Upload the issue PDF once here. The uploader will generate stable page images from it so Vanguard articles can
									reuse page 1 or page 2 directly.
								</p>
								<div className={styles["file-input"]}>
									<label
										onDragEnter={e => e.currentTarget.classList.add(styles["dragover"])}
										onDragLeave={e => e.currentTarget.classList.remove(styles["dragover"])}
										onDragEnd={e => e.currentTarget.classList.remove(styles["dragover"])}
										onDragOver={e => e.preventDefault()}
										onDrop={inputImageDrop.bind(globalThis, updateSpread)}
									>
										<span className={styles["drop-img-prompt"]}>Drop Spread PDF Here (or click to upload)</span>
										<span className={styles["uploaded-prompt"]}>
											<i className="fa-solid fa-check"></i>
											<span className="img-name"></span> uploaded!
										</span>
										<input id="spread-upload" type="file" accept=".pdf" onChange={e => void updateSpread(e.target)} />
									</label>
								</div>
								{spreadPageAssets.length > 0 && (
									<p className={styles["spread-summary"]}>
										Prepared {spreadPageAssets.length} page image{spreadPageAssets.length === 1 ? "" : "s"} for this spread.
									</p>
								)}
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

							{formData.category && (
								<div className={styles["submit-row"]}>
									<button type="submit">
										{editingArticleId !== null && isArticleLikeSection
											? "Update Article"
											: isVanguardSpread
											? "Submit Spread"
											: formData.category === "multimedia"
											? "Submit Multimedia"
											: "Submit Article"}
									</button>
								</div>
							)}

							{isArticleLikeSection && (
								<div className={styles["existing-articles"]}>
									<div className={styles["existing-articles-header"]}>
										<strong>{`Uploaded Articles (${MONTH_NAMES[selectedMonth]} ${selectedYear})`}</strong>
										{editingArticleId !== null && (
											<div className={styles["existing-articles-actions"]}>
												<button type="button" onClick={clearEditingState}>
													New article
												</button>
												<button
													type="button"
													onClick={deleteLoadedDraft}
													disabled={deletingDraft}
													className={styles["delete-draft-button"]}
												>
													{deletingDraft ? "Deleting..." : "Delete Draft"}
												</button>
											</div>
										)}
									</div>
									{issueArticlesLoading && <p>Loading uploaded articles...</p>}
									{!issueArticlesLoading && filteredIssueArticles.length === 0 && (
										<p>
											{category
												? "No uploaded articles for this category this month yet."
												: "No uploaded articles for this month yet."}
										</p>
									)}
									{!issueArticlesLoading && filteredIssueArticles.length > 0 && (
										<div className={styles["existing-articles-list"]}>
											{filteredIssueArticles.map(item => (
												<button
													type="button"
													key={item.id}
													onClick={() => loadArticleForEditing(item.id)}
													className={editingArticleId === item.id ? styles["existing-article-active"] : ""}
													disabled={loadingArticleId === item.id || item.published}
												>
													<span>
														{item.title} <small>#{item.id}</small>
													</span>
													<span>
														{item.category} /{" "}
														{item.category === "vanguard"
															? normalizeVanguardSubcategory(item.subcategory)
															: item.subcategory}{" "}
														• {item.published ? "published (locked)" : "draft"}
													</span>
													{loadingArticleId === item.id && <span>Loading...</span>}
												</button>
											))}
										</div>
									)}
								</div>
							)}
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
								display: previewWidth === 0 ? "none" : undefined,
							}}
						>
							{/* PREVIEW BLOCK */}
							<div style={{ textAlign: "left" }}>
								{isArticleLikeSection && (
									<ArticleContent
										showColumnAd={false}
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
											img: articlePreviewImage,
											markdown: true,
											contentInfo: formData.contentInfo ?? null,
											featured: null,
										}}
									/>
								)}
								{isVanguardSpread && (
									<div style={{ padding: "1rem" }}>
										<h3>{formData.title || "Vanguard spread preview"}</h3>
										<SpreadGallery spreadSrc="" pagePreviewUrls={spreadPreviewUrls} showDownload={false} />
									</div>
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
						</section>
					</div>

					<br />
					<p id="bruh" ref={errorRef}>
						{uploadResponse}
					</p>
				</form>
			</div>

			<SavingIndicator uploadStatus={uploadStatus} isSaving={isSaving} />
		</div>
	);
}
