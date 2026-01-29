/** @format */

import { FaFacebookSquare, FaInstagramSquare, FaYoutubeSquare, FaSpotify } from "react-icons/fa";
import { SiApplepodcasts } from "react-icons/si";

export const socialLinks = [
	{
		name: "Instagram",
		url: "https://www.instagram.com/thetowerphs/",
		icon: FaInstagramSquare,
	},
	{
		name: "Facebook",
		url: "https://www.facebook.com/phstower",
		icon: FaFacebookSquare,
	},
	{
		name: "YouTube",
		url: "https://www.youtube.com/@PHS-TowerMultimedia",
		icon: FaYoutubeSquare,
	},
	{
		name: "Spotify",
		url: "https://open.spotify.com/show/2c0TlU1f01LKoVPaMMDxB8?si=f1fa622c0339438e",
		icon: FaSpotify,
	},
	{
		name: "Apple Podcasts",
		url: "https://podcasts.apple.com/us/podcast/tower-shorts/id1709406261",
		icon: SiApplepodcasts,
	},
];

export const years = ["2026, 2025", "2024", "2023", "2022"];
// add an empty string "" between every year so a line seperator appears

export const categorySlugs = new Map<string, string>([
	["news-features", "News & Features"],
	["phs-profiles", "PHS Profiles"],
	["cheers-jeers", "Cheers & Jeers"],
	["arts-entertainment", "Arts & Entertainment"],
	["special", "Special Issues"],
	["nsi", "New Student Issues"],
]);

export const normalCategories = ["news-features", "opinions", "arts-entertainment", "sports", "special"];
export const categories = ["news-features", "multimedia", "opinions", "vanguard", "arts-entertainment", "sports", "special"];

export const subcategories = [
	["news-features", "phs-profiles"],
	["opinions", "editorials"],
	["opinions", "cheers-jeers"],
	["vanguard", "random-musings"],
	["vanguard", "spreads"],
	["arts-entertainment", "student-artists"],
	["sports", "student-athletes"],
	["special", "nsi"],
];

export const months: string[] = [
	"",
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];
