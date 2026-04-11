/** @format */

import Head from "next/head";
import { ChangeEvent, FormEvent, useCallback, useEffect, useState, useRef, DragEvent } from "react";
import Link from "next/link";
import { remark } from "remark";
import html from "remark-html";
import confetti from "canvas-confetti";
import type { spreads } from "@prisma/client";
import styles from "./upload.module.scss";
import { ArticleContent } from "../articles/[year]/[month]/[cat]/[slug]";
import dynamic from "next/dynamic";
import SpreadGallery from "~/components/spreadgallery.client";
import CrosswordBuilder, {
	createEmptyCrosswordDraft,
	hasCrosswordDraftContent,
	normalizeCrosswordDraft,
	serializeCrosswordDraft,
	type CrosswordDraft,
} from "~/components/crosswordbuilder.client";
import { getSpreadPageImageUrl, inferVanguardPageFromImageUrl, parseSpreadSource } from "~/lib/utils";
import {
	buildLegacyVanguardSpreadPageAsset as createLegacyVanguardSpreadPageAsset,
	buildPdfPreviewImages,
	convertHeicToPng,
	prepareArticleImageUpload,
	setFileInputVisualState,
} from "~/lib/upload/client";
import {
	attemptUpload,
	deleteUploadDraft,
	fetchArticleForEditing,
	fetchIssueArticles,
	fetchIssueVanguardSpread,
	uploadArticleImageDirect,
	uploadVanguardSpreadPdfDirect,
} from "~/lib/upload/api";
import {
	THREE_DAYS_MS,
	MONTH_NAMES,
	formatBytes,
	hasAllowedImageExtension,
	isHeicLike,
	normalizeVanguardSubcategory,
	type FormDataType,
	type UploadListItem,
} from "~/lib/upload/shared";

const Video = dynamic(() => import("~/components/video.client"), { ssr: false });
const Podcast = dynamic(() => import("~/components/podcast.client"), { ssr: false });

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
	const [spreadPageCount, setSpreadPageCount] = useState(0);
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
	const [legacyVanguardPagePreviewUrl, setLegacyVanguardPagePreviewUrl] = useState("");
	const [completedUploadMessage, setCompletedUploadMessage] = useState("");
	const [crosswordDraft, setCrosswordDraft] = useState<CrosswordDraft>(() => createEmptyCrosswordDraft());

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
	const isCrosswordSection = category === "crossword";
	const isArticleLikeSection = Boolean(category && category !== "multimedia" && category !== "crossword" && !isVanguardSpread);
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
			? issueVanguardSpreadPageCount > 0
				? getSpreadPageImageUrl(issueVanguardSpread.src, selectedVanguardPageNumber)
				: legacyVanguardPagePreviewUrl
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
	const hasResettableArticleFields = Boolean(
		formData.title?.trim() ||
			formData.authors?.trim() ||
			formData.content?.trim() ||
			formData.contentInfo?.trim() ||
			formData.imgData ||
			formData.vanguardPageNumber
	);
	const hasStoredDraftContent = Boolean(
		formData.title?.trim() ||
			formData.authors?.trim() ||
			formData.content?.trim() ||
			formData.contentInfo?.trim() ||
			formData.multi?.trim() ||
			formData.imgData ||
			formData.spread ||
			formData.vanguardPageNumber ||
			(category === "crossword" && hasCrosswordDraftContent(crosswordDraft))
	);

	useEffect(() => {
		return () => {
			spreadPreviewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
		};
	}, []);

	const buildLegacyVanguardSpreadPageAsset = useCallback(
		async (spreadSrc: string, pageNumber: number) =>
			await createLegacyVanguardSpreadPageAsset(spreadSrc, pageNumber, `vanguard-${selectedYear}-${selectedMonth}-page-${pageNumber}`),
		[selectedMonth, selectedYear]
	);

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
			if (normalizedRest?.crosswordDraft) setCrosswordDraft(normalizeCrosswordDraft(normalizedRest.crosswordDraft));
		} else {
			localStorage.removeItem("uploadFormData");
			localStorage.removeItem("uploadFormTimestamp");
		}
	}, []);

	// Save to localStorage on every update
	useEffect(() => {
		if (!hydrated) return;
		// Persist core fields only; month/year should not be saved
		const { category, subcategory, title, authors, content, multi, contentInfo, vanguardPageNumber } = formData;
		const fieldsToStore = {
			category,
			subcategory,
			title,
			authors,
			content,
			multi,
			contentInfo,
			vanguardPageNumber,
			crosswordDraft: category === "crossword" ? crosswordDraft : undefined,
		};

		if (!hasStoredDraftContent) {
			localStorage.removeItem("uploadFormData");
			localStorage.removeItem("uploadFormTimestamp");
			setIsSaving(false);
			return;
		}

		setIsSaving(true);
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
	}, [crosswordDraft, formData, hasStoredDraftContent, hydrated]);

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
				const spread = await fetchIssueVanguardSpread(selectedMonth, selectedYear);
				if (!cancelled) setIssueVanguardSpread(spread);
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

	useEffect(() => {
		if (!isVanguardArticle || hasManualHeaderImage || !selectedVanguardPageNumber || !issueVanguardSpread || issueVanguardSpreadPageCount > 0) {
			setLegacyVanguardPagePreviewUrl("");
			return;
		}

		let cancelled = false;
		let previewUrlToRevoke = "";

		(async () => {
			try {
				const { previewUrl } = await buildLegacyVanguardSpreadPageAsset(issueVanguardSpread.src, selectedVanguardPageNumber);
				previewUrlToRevoke = previewUrl;
				if (cancelled) {
					URL.revokeObjectURL(previewUrl);
					return;
				}
				setLegacyVanguardPagePreviewUrl(previewUrl);
			} catch (error) {
				console.error(error);
				if (!cancelled) {
					setLegacyVanguardPagePreviewUrl("");
				}
			}
		})();

		return () => {
			cancelled = true;
			if (previewUrlToRevoke) URL.revokeObjectURL(previewUrlToRevoke);
		};
	}, [
		buildLegacyVanguardSpreadPageAsset,
		isVanguardArticle,
		hasManualHeaderImage,
		selectedVanguardPageNumber,
		issueVanguardSpread,
		issueVanguardSpreadPageCount,
	]);

	// Re-trigger error animation
	function triggerErrorAnimation() {
		if (errorRef.current) {
			errorRef.current.classList.remove("error-message");
			void errorRef.current.offsetWidth;
			errorRef.current.classList.add("error-message");
		}
	}

	function dismissCompletedUploadMessage() {
		setCompletedUploadMessage("");
	}

	function replaceSpreadPreviewUrls(urls: string[]) {
		spreadPreviewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
		spreadPreviewUrlsRef.current = urls;
		setSpreadPreviewUrls(urls);
	}

	async function refreshIssueArticles(month: number, year: number) {
		setIssueArticlesLoading(true);
		try {
			setIssueArticles(await fetchIssueArticles(month, year));
		} catch (error) {
			console.error(error);
			setIssueArticles([]);
		} finally {
			setIssueArticlesLoading(false);
		}
	}

	async function loadArticleForEditing(id: number) {
		dismissCompletedUploadMessage();
		setLoadingArticleId(id);
		try {
			const loaded = await fetchArticleForEditing(id);
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
			setSpreadPageCount(0);
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
			const month = formData.month ?? new Date().getMonth() + 1;
			const year = formData.year ?? new Date().getFullYear();
			clearEditingState();
			setUploadResponse(await deleteUploadDraft(editingArticleId));
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
		setLegacyVanguardPagePreviewUrl("");
		setFormData({
			month: selectedMonth,
			year: selectedYear,
		});
		setPreviewContent("");
		replaceSpreadPreviewUrls([]);
		setSpreadPageCount(0);
		setImgOrigBytes(null);
		setServerImgBytes(null);
	}

	function changeCategory(e: ChangeEvent<HTMLSelectElement>) {
		dismissCompletedUploadMessage();
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
				: nextCategory === "crossword"
				? ""
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
			setSpreadPageCount(0);
		}
	}

	function changeSubcategory(e: ChangeEvent<HTMLSelectElement>) {
		dismissCompletedUploadMessage();
		const nextSubcategory = e.target.value;
		setFormData({
			...formData,
			subcategory: nextSubcategory,
			spread: nextSubcategory === "spreads" ? formData.spread : null,
			vanguardPageNumber: nextSubcategory === "articles" ? formData.vanguardPageNumber : null,
		});
		if (category === "vanguard" && nextSubcategory !== "spreads") {
			replaceSpreadPreviewUrls([]);
			setSpreadPageCount(0);
		}
	}

	function updateTitle(e: ChangeEvent<HTMLInputElement>) {
		dismissCompletedUploadMessage();
		setFormData({ ...formData, title: e.target.value });
	}

	function updateAuthors(e: ChangeEvent<HTMLInputElement>) {
		dismissCompletedUploadMessage();
		setFormData({ ...formData, authors: e.target.value });
	}

	function changeMonth(e: ChangeEvent<HTMLSelectElement>) {
		dismissCompletedUploadMessage();
		const m = parseInt(e.target.value, 10);
		if (!isNaN(m)) setFormData({ ...formData, month: m });
	}

	function changeYear(e: ChangeEvent<HTMLInputElement>) {
		dismissCompletedUploadMessage();
		const y = parseInt(e.target.value, 10);
		setFormData({ ...formData, year: !isNaN(y) ? y : null });
	}

	function updateVanguardPageNumber(e: ChangeEvent<HTMLInputElement>) {
		dismissCompletedUploadMessage();
		const value = parseInt(e.target.value, 10);
		setFormData({ ...formData, vanguardPageNumber: !isNaN(value) ? value : null });
	}

	async function updateContent(e: ChangeEvent<HTMLTextAreaElement>) {
		dismissCompletedUploadMessage();
		setFormData({ ...formData, content: e.target.value });
		const processed = await remark().use(html).process(e.target.value);
		setPreviewContent(processed.toString());
	}

	// New: Update Header Info from a resizable textarea
	function updateHeaderInfo(e: ChangeEvent<HTMLTextAreaElement>) {
		dismissCompletedUploadMessage();
		setFormData({ ...formData, contentInfo: e.target.value });
	}

	async function updateImage(inp: HTMLInputElement) {
		dismissCompletedUploadMessage();
		if (!inp.files || !inp.files[0]) return;
		let image = inp.files[0];

		if (!hasAllowedImageExtension(image.name)) {
			alert("Invalid file format. Please select a JPG, JPEG, PNG, WEBP, GIF, HEIC, or HEIF file.");
			inp.value = "";
			setFormData({ ...formData, img: null, imgData: null, imgName: null });
			setFileInputVisualState(inp, styles["has-file"]);
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
				setFileInputVisualState(inp, styles["has-file"]);
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
		setFileInputVisualState(inp, styles["has-file"]);
	}

	function clearImage() {
		dismissCompletedUploadMessage();
		setFormData({ ...formData, img: null, imgData: null, imgName: null });
		setImgOrigBytes(null);
		setServerImgBytes(null);
		const inp = document.getElementById("article-img-upload") as HTMLInputElement | null;
		if (inp) {
			inp.value = "";
			setFileInputVisualState(inp, styles["has-file"]);
		}
	}

	function clearDraftFields() {
		dismissCompletedUploadMessage();
		setEditingArticleId(null);
		setUploadResponse("");
		setUploadStatus("normal");
		setPreviewContent("");
		setLegacyVanguardPagePreviewUrl("");
		replaceSpreadPreviewUrls([]);
		setSpreadPageCount(0);
		setImgOrigBytes(null);
		setServerImgBytes(null);
		localStorage.removeItem("uploadFormData");
		localStorage.removeItem("uploadFormTimestamp");
		setFormData(prev => ({
			...prev,
			title: "",
			authors: "",
			content: "",
			contentInfo: "",
			img: null,
			imgData: null,
			imgName: null,
			vanguardPageNumber: null,
		}));

		const articleImageInput = document.getElementById("article-img-upload") as HTMLInputElement | null;
		if (articleImageInput) {
			articleImageInput.value = "";
			setFileInputVisualState(articleImageInput, styles["has-file"]);
		}

		const spreadInput = document.getElementById("spread-upload") as HTMLInputElement | null;
		if (spreadInput) {
			spreadInput.value = "";
			setFileInputVisualState(spreadInput, styles["has-file"]);
		}
	}

	// Update PDF spread (for Vanguard)
	async function updateSpread(inp: HTMLInputElement) {
		dismissCompletedUploadMessage();
		if (!inp.files || !inp.files[0]) return;
		const file = inp.files[0];
		if (file.type !== "application/pdf") {
			alert("Invalid file format. Please upload a PDF file.");
			setUploadResponse("Upload failed: Please upload a PDF file for Vanguard.");
			setUploadStatus("error");
			triggerErrorAnimation();
			inp.value = "";
			setFormData({ ...formData, spread: null });
			setFileInputVisualState(inp, styles["has-file"]);
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
			setFileInputVisualState(inp, styles["has-file"]);
			return;
		}

		try {
			setUploadResponse("Preparing Vanguard spread preview...");
			const { previewUrls, pageCount } = await buildPdfPreviewImages(file);
			setFormData(prev => ({ ...prev, spread: file }));
			setSpreadPageCount(pageCount);
			replaceSpreadPreviewUrls(previewUrls);
			setFileInputVisualState(inp, styles["has-file"]);
			setUploadResponse(`Prepared ${pageCount} Vanguard spread page${pageCount === 1 ? "" : "s"} for preview.`);
		} catch (error: any) {
			console.error(error);
			inp.value = "";
			setFormData(prev => ({ ...prev, spread: null }));
			setSpreadPageCount(0);
			replaceSpreadPreviewUrls([]);
			setFileInputVisualState(inp, styles["has-file"]);
			setUploadResponse(`Upload failed: ${error?.message || "Could not process the Vanguard PDF."}`);
			setUploadStatus("error");
			triggerErrorAnimation();
		}
	}

	function updateMulti(e: ChangeEvent<HTMLInputElement>) {
		dismissCompletedUploadMessage();
		setFormData({ ...formData, multi: e.target.value });
	}

	async function submitArticle(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setUploadResponse("Checking...");
		setServerImgBytes(null);

		if (!formData.category) {
			setUploadResponse("Upload failed: You need to select a category.");
			setUploadStatus("error");
			triggerErrorAnimation();
			return;
		}
		if (formData.category !== "crossword" && !formData.title) {
			setUploadResponse("Upload failed: You need a title.");
			setUploadStatus("error");
			triggerErrorAnimation();
			return;
		}
		if (formData.category === "crossword") {
			const serializedCrossword = serializeCrosswordDraft(crosswordDraft);
			if (!serializedCrossword.ok) {
				setUploadResponse(serializedCrossword.error);
				setUploadStatus("error");
				triggerErrorAnimation();
				return;
			}
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
		if (isVanguardSpread && (!formData.spread || spreadPageCount === 0)) {
			setUploadResponse("Upload failed: upload the Vanguard spread PDF so the page preview can be generated.");
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

		// Prepare any new article image for a direct storage upload before the metadata request.
		let preparedImg: File | null = formData.img ?? null;
		let preparedImgClientCompressed = false;
		let directUploadedImagePath = "";
		let directUploadedImageSizeBytes: number | null = null;
		if (isVanguardArticle && !formData.img && selectedVanguardPageNumber && issueVanguardSpread && issueVanguardSpreadPageCount === 0) {
			try {
				const rendered = await buildLegacyVanguardSpreadPageAsset(issueVanguardSpread.src, selectedVanguardPageNumber);
				preparedImg = rendered.file;
				preparedImgClientCompressed = true;
				URL.revokeObjectURL(rendered.previewUrl);
			} catch (error: any) {
				setUploadResponse(`Upload failed: ${error?.message || "Could not render the selected Vanguard spread page."}`);
				setUploadStatus("error");
				triggerErrorAnimation();
				return;
			}
		}

		if (isArticleLikeSection && preparedImg) {
			let uploadReadyImage = preparedImg;

			if (!preparedImgClientCompressed) {
				setUploadResponse("Preparing header image...");
				try {
					const preparedUploadImage = await prepareArticleImageUpload(preparedImg);
					uploadReadyImage = preparedUploadImage.file;
					preparedImgClientCompressed = preparedUploadImage.compressed;
				} catch (error) {
					console.warn("Client image preparation failed, uploading original file instead.", error);
					uploadReadyImage = preparedImg;
				}
			}

			setUploadResponse("Uploading header image...");
			try {
				const directImageUpload = await uploadArticleImageDirect(uploadReadyImage);
				if (!directImageUpload.path) {
					throw new Error("The image upload finished without a valid storage path.");
				}
				directUploadedImagePath = directImageUpload.path;
				directUploadedImageSizeBytes = directImageUpload.sizeBytes;
			} catch (error: any) {
				setUploadResponse(`Upload failed: ${error?.message || "Could not upload the article image."}`);
				setUploadStatus("error");
				triggerErrorAnimation();
				return;
			}
		}

		// Vanguard
		if (isVanguardSpread) {
			if (!formData.spread) {
				setUploadResponse("Upload failed: You need to upload a spread PDF for Vanguard.");
				setUploadStatus("error");
				triggerErrorAnimation();
				return;
			}

			setUploadResponse("Uploading Vanguard PDF...");
			let directUpload: { path: string };
			try {
				directUpload = await uploadVanguardSpreadPdfDirect(formData.spread);
			} catch (error: any) {
				setUploadResponse(`Upload failed: ${error?.message || "Could not upload the Vanguard PDF."}`);
				setUploadStatus("error");
				triggerErrorAnimation();
				return;
			}
			if (!directUpload.path) {
				setUploadResponse("Upload failed: the Vanguard PDF upload finished without a valid storage path.");
				setUploadStatus("error");
				triggerErrorAnimation();
				return;
			}

			fd.append("subcategory", "spreads");
			fd.append("spread-storage-path", directUpload.path);
			fd.append("title", formData.title || "");
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
			fd.append("title", formData.title || "");
		} else if (formData.category === "crossword") {
			const serializedCrossword = serializeCrosswordDraft(crosswordDraft);
			if (!serializedCrossword.ok) {
				setUploadResponse(serializedCrossword.error);
				setUploadStatus("error");
				triggerErrorAnimation();
				return;
			}
			fd.append("crossword-title", serializedCrossword.value.title);
			fd.append("crossword-author", serializedCrossword.value.author);
			fd.append("crossword-date", serializedCrossword.value.date);
			fd.append("crossword-clues", JSON.stringify(serializedCrossword.value.clues));
		}
		// Everything else (standard article)
		else {
			fd.append("subcategory", formData.subcategory || formData.category);
			fd.append("title", formData.title || "");
			fd.append("authors", JSON.stringify(authors));
			if (formData.content) fd.append("content", formData.content);
			if (directUploadedImagePath) {
				fd.append("image-storage-path", directUploadedImagePath);
				if (directUploadedImageSizeBytes !== null) fd.append("image-upload-size-bytes", String(directUploadedImageSizeBytes));
			} else if (preparedImg) {
				fd.append("img", preparedImg);
				if (preparedImgClientCompressed) fd.append("img-client-compressed", "1");
			}
			if (!preparedImg && editingArticleId !== null) fd.append("existing-img", formData.imgData ? String(formData.imgData) : "");
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
					if (directUploadedImageSizeBytes !== null) setServerImgBytes(directUploadedImageSizeBytes);
				}
				setCompletedUploadMessage(data.message || "Uploaded!");
				setUploadStatus("success");
				if (errorRef.current) errorRef.current.classList.remove("error-message");
				confetti();
				if (formData.category === "crossword") {
					setCrosswordDraft(createEmptyCrosswordDraft());
				} else {
					clearEditingState();
				}
				setUploadResponse("");
				localStorage.removeItem("uploadFormData");
				localStorage.removeItem("uploadFormTimestamp");
				if (formData.category !== "crossword") void refreshIssueArticles(Number(chosenMonth), Number(chosenYear));
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
							<option value="crossword">Crossword</option>
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
					{completedUploadMessage && <p className={styles["completed-upload-message"]}>{completedUploadMessage}</p>}

					<div className={styles["section-info"]} ref={containerRef}>
						<section className={styles["section-input"]}>
							<div id={styles["std-sections"]} style={{ display: isArticleLikeSection ? "block" : "none" }}>
								<h3>{category === "vanguard" ? "Vanguard Article" : "Article"}</h3>
								{hasResettableArticleFields && (
									<button type="button" onClick={clearDraftFields} className={styles["reset-query-button"]}>
										Clear draft
									</button>
								)}
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
								{spreadPageCount > 0 && (
									<p className={styles["spread-summary"]}>
										Prepared {spreadPageCount} page preview{spreadPageCount === 1 ? "" : "s"} for this spread.
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

							<div style={{ display: isCrosswordSection ? "block" : "none" }}>
								<h3>Crossword Builder</h3>
								<p>Build the grid directly here, black out squares, fill letters, and write clues for each across/down entry.</p>
								<CrosswordBuilder value={crosswordDraft} onChange={setCrosswordDraft} />
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
											: formData.category === "crossword"
											? "Submit Crossword"
											: "Submit Article"}
									</button>
									<p id="bruh" ref={errorRef} className={styles["submit-response"]}>
										{uploadResponse}
									</p>
								</div>
							)}

							{isArticleLikeSection && (
								<div className={styles["existing-articles"]}>
									<div className={styles["existing-articles-header"]}>
										<strong>{`Uploaded Articles (${MONTH_NAMES[selectedMonth]} ${selectedYear})`}</strong>
										{editingArticleId !== null && (
											<div className={styles["existing-articles-actions"]}>
												<button
													type="button"
													onClick={() => {
														dismissCompletedUploadMessage();
														clearEditingState();
													}}
												>
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
											spotifyUrl: null,
											Index: false,
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

								{isCrosswordSection && (
									<div style={{ padding: "1rem" }}>
										<h3>{crosswordDraft.title?.trim() || "Crossword Preview"}</h3>
										<p>
											The builder on the left is the source of truth. Use it to set the title, grid, black squares, answers, and
											clue text.
										</p>
										<p>Published crosswords will use this title on the live page, in the archive, and in search.</p>
									</div>
								)}
							</div>
						</section>
					</div>

					<br />
				</form>
			</div>

			<SavingIndicator uploadStatus={uploadStatus} isSaving={isSaving} />
		</div>
	);
}
