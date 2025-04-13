/** @format */

import Link from "next/link";
import styles from "~/lib/styles";
import { useState, useRef, useEffect } from "react";

interface Props {
	name: string;
	href: string;
	children?: React.ReactNode;
	className?: string;
	onClick?: () => void;
}

export default function Button({ name, href, children, className, onClick }: Props) {
	const [isOpen, setIsOpen] = useState(false);
	const contentRef = useRef<HTMLDivElement>(null);
	const [maxHeight, setMaxHeight] = useState("0px");

	useEffect(() => {
		if (isOpen && contentRef.current) {
			setMaxHeight(`${contentRef.current.scrollHeight}px`);
		} else {
			setMaxHeight("0px");
		}
	}, [isOpen]);

	return (
		<div className={`dropdown ${className || ""}`} onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)} onClick={onClick}>
			<style jsx>{`
				.dropdown {
					position: relative;
					display: inline-block;
					text-align: center;
				}

				.btn {
					color: white;
					padding: 1rem 1.4rem;
					font-family: ${styles.font.sans};
					background-color: transparent;
					text-align: center;
					cursor: pointer;
					text-transform: uppercase;
					font-size: 1.4rem;
					display: inline-block;
					transition: background 0.2s ease-in-out;
				}

				.btn:hover {
					background-color: rgba(255, 255, 255, 0.1);
				}

				.content {
					position: absolute;
					top: 100%;
					left: 50%;
					transform: translateX(-50%);
					width: max-content;
					min-width: 180px;
					max-width: 240px;
					overflow: hidden;
					max-height: 0;
					transition: max-height 0.3s ease;
					background-color: white;
					border: 1px solid #ddd;
					z-index: 999;
					box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
				}

				.content.show {
					max-height: ${maxHeight};
				}

				.content a {
					display: block;
					padding: 0.9rem 1.2rem;
					text-decoration: none;
					color: ${styles.color.primary};
					font-size: 1.05rem;
					border-bottom: 1px solid #eee;
				}

				.content a:last-child {
					border-bottom: none;
				}

				@media screen and (max-width: 1000px) {
					.dropdown,
					.btn {
						display: block;
						width: 100%;
					}
					.content {
						left: 0;
						transform: none;
						width: 100%;
					}
				}
			`}</style>

			<Link href={href} legacyBehavior>
				<a className="btn">{name}</a>
			</Link>

			{children && (
				<div className={`content ${isOpen ? "show" : ""}`} ref={contentRef}>
					{children}
				</div>
			)}
		</div>
	);
}
