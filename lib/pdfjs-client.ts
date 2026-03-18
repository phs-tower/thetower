/** @format */

let pdfjsModulePromise: Promise<any> | null = null;

export async function getPdfJs() {
	if (!pdfjsModulePromise) {
		pdfjsModulePromise = import("pdfjs-dist/legacy/build/pdf.mjs").then(pdfjs => {
			if (pdfjs?.GlobalWorkerOptions) {
				pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
			}
			return pdfjs;
		});
	}

	return await pdfjsModulePromise;
}
