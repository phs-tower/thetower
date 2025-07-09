/** @format */

import Document, { DocumentContext, DocumentInitialProps, Head, Html, Main, NextScript } from "next/document";

export default class TowerDocument extends Document {
	static async getInitialProps(ctx: DocumentContext): Promise<DocumentInitialProps> {
		const initialProps = await Document.getInitialProps(ctx);
		return { ...initialProps };
	}

	render(): React.ReactElement {
		return (
			<Html lang="en">
				<Head>
					<meta name="twitter:site" content="The Tower" />
					<meta name="twitter:creator" content="The Tower" />
					<meta name="twitter:title" content={`The Tower - Year ${new Date().getFullYear() - 1928}`} />
					<meta name="twitter:description" content="The Tower is Princeton High School's newspaper club." />
					<meta property="og:locale" content="en_US" />
					<meta property="og:site_name" content="The Tower" />
					<meta property="og:title" content={`The Tower - Year ${new Date().getFullYear() - 1928}`} />
					<meta property="og:description" content="The Tower is Princeton High School's newspaper club." />
					<meta property="og:image" content="/assets/default.png" />
					<meta property="og:type" content="website" />
					<meta name="robots" content="index, follow" />
					<meta name="keywords" content="Newspaper, PHS, Princeton, The Tower, Tower" />
				</Head>
				<body>
					{/* <style>{`body { height: 100%; }`}</style> */}
					<Main />
					<NextScript />
				</body>
			</Html>
		);
	}
}
