/** @format */

import Image from "next/image";
import styles from "./advertisement.module.scss";

interface Props {
	src: string;
	href: string;
	alt: string;
	width: number;
	height: number;
	caption?: string;
	className?: string;
}

export default function Advertisement({ src, href, alt, width, height, caption, className }: Props) {
	return (
		<aside className={`${styles.box} ${className ?? ""}`} aria-label="Advertisement">
			<div className={styles.label}>ADVERTISEMENT</div>
			<a href={href} target="_blank" rel="sponsored noopener noreferrer" className={styles.imageLink}>
				<Image src={src} alt={alt} width={width} height={height} loading="lazy" />
			</a>
			{caption && (
				<div className={styles.caption}>
					<a href={href} target="_blank" rel="sponsored noopener noreferrer" className={styles.captionLink}>
						{caption}
					</a>
				</div>
			)}
		</aside>
	);
}
