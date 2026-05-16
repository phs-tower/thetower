/** @format */

export interface ArticleColumnSponsor {
	enabled: boolean;
	src: string;
	href: string;
	alt: string;
	caption: string;
	width: number;
	height: number;
}

// To run a future article-column sponsor:
// 1. Put the image in public/assets with a neutral filename.
// 2. Set enabled to true.
// 3. Update src, href, alt, caption, width, and height.
export const articleColumnSponsor: ArticleColumnSponsor = {
	enabled: false,
	src: "",
	href: "",
	alt: "",
	caption: "",
	width: 160,
	height: 600,
};
