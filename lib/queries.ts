/** @format */

import { article, PrismaClient, spreads, multimedia, Prisma } from "@prisma/client";
import { PuzzleInput } from "./crossword/types";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { StorageApiError } from "@supabase/storage-js";
import { readFile } from "fs/promises";
import formidable from "formidable";
import path from "path";
import { randomUUID } from "crypto";

let yolo = false;

if (process.env.SERVICE_ROLE == undefined) {
	// throw new Error("Set up your .env!");
	console.warn("No .env file ... defaulting to yolo mode");
	yolo = true;
}

const prisma = yolo ? undefined : new PrismaClient();
const supabase = !process.env.SERVICE_ROLE ? undefined : createClient("https://yusjougmsdnhcsksadaw.supabase.co/", process.env.SERVICE_ROLE);

export async function getFrontpageArticles() {
	let articles: Record<string, article[]> = { "news-features": [], opinions: [], "arts-entertainment": [], sports: [], featured: [] };
	if (!prisma) return articles;

	const categories = Object.keys(articles);

	for (let i = 0; i < categories.length - 1; i++) {
		const curr = new Date();
		let month = curr.getMonth() + 3;
		let year = curr.getFullYear();

		while (!articles[categories[i]].length) {
			month--;

			let temp = await prisma.article.findMany({
				orderBy: [
					{
						id: "asc",
					},
				],
				where: {
					year: year,
					month: month,
					category: categories[i],
					published: true,
				},
			});
			articles[categories[i]] = temp;
			if (month === 0) {
				month = 13;
				year--;
			}
		}
	}

	let a = await prisma.article.findFirst({ where: { featured: true } });
	if (a != null) articles["featured"].push(a);

	// a = await prisma.spreads.findFirst({orderBy: {year: "desc", month: "desc"}, where: {title: {startsWith: "VANGUARD"}}})
	// if (a != null) articles.vanguard.push(a)

	return articles;
}

export async function getPublishedArticles() {
	if (!prisma) return [];
	const articles = await prisma.article.findMany({
		where: {
			published: true,
		},
	});

	return articles;
}
export async function getArticle(year: string, month: string, cat: string, id: string, slug: string): Promise<article | null> {
	if (!prisma)
		return {
			id: 0,
			title: "LOLLERS EPIC CONTENT",
			content:
				"Lorem ipsum dolor sit amet, consectetur adipisicing elit. Itaque placeat, dolores a culpa, modi animi, nulla architecto possimus autem molestias unde inventore officiis similique ut soluta tempore accusantium molestiae maiores! Omnis alias esse asperiores blanditiis illo aliquam laboriosam facilis assumenda exercitationem in autem quod consectetur, ut commodi eaque, illum nam. Temporibus voluptatem deserunt sit aut autem exercitationem fugit quia consectetur. Animi debitis accusantium sint minus facere neque culpa voluptas cumque, ipsam maiores sit, minima in assumenda rem? Officiis, quae, voluptate voluptatem porro fuga veniam tenetur neque libero et culpa quasi? Harum odio temporibus ullam sit! Blanditiis omnis, voluptatem eaque neque veritatis nesciunt laborum soluta illum modi cupiditate. Laboriosam quasi architecto odio officia possimus ipsum obcaecati dolorum recusandae, ipsam sed tempora. Deserunt tenetur magnam ducimus commodi. Laborum ad omnis, aut illum ea quaerat vel architecto aliquam temporibus repellat? Doloremque enim totam ad delectus quae, harum blanditiis? Ducimus voluptatem doloribus nesciunt debitis? In sint illo aut itaque possimus velit architecto harum voluptas enim fugit quae voluptatem nihil eius consequatur doloremque nam perferendis alias nobis modi dolorum ex totam eveniet, quam ut. Officia. Recusandae consequuntur ducimus, sint vitae beatae corrupti natus nemo, molestiae deserunt rem laborum exercitationem odio, eos tempore? Ullam, inventore aut excepturi, illo soluta perspiciatis, quam fugiat eaque quis officia doloremque? Ipsam illo totam illum, repudiandae minima rem quidem temporibus in dolorem laudantium blanditiis dolorum corporis numquam aperiam, vel id repellat! Animi quibusdam ab eos nisi eveniet ducimus quae sit laudantium. Itaque vitae nulla, delectus nobis recusandae accusantium nostrum quis fugit ipsa perferendis eius molestias totam. Minima qui iusto nulla autem veritatis, esse culpa cupiditate temporibus totam modi? Debitis, nam accusamus. Odit placeat sequi deleniti, magni illum harum inventore? Corporis quas doloremque sapiente enim laboriosam maiores molestias neque facere aut inventore eligendi mollitia consequatur illo hic, earum, consequuntur nihil. Dolor, deleniti. Ex optio fugit laborum beatae non laudantium illo quos deleniti ratione labore, qui aliquam, nisi, quaerat architecto. Excepturi reiciendis maiores tempore maxime, nobis deleniti quibusdam possimus corporis, veritatis ad ipsam. Atque quam doloribus unde nam aliquam aliquid at quae dolore quibusdam vitae provident odio pariatur sint ipsum cum enim deserunt incidunt qui accusantium adipisci, illum, saepe sapiente eius! Temporibus, libero. Repudiandae voluptates laboriosam tenetur fugiat optio a tempore ipsam! Labore eveniet velit ipsam repudiandae a optio in nisi iure est, voluptatibus facere voluptatum architecto. Temporibus non sed velit eum nulla! Consequuntur ab harum illum corporis ex distinctio, itaque facere eius maxime, enim necessitatibus quos temporibus quibusdam deserunt aperiam consequatur? Quasi nulla illum earum eos officiis totam quae non modi eaque. Error ad excepturi ipsum doloribus. Error cum distinctio corrupti aperiam nesciunt odio natus ut ratione nostrum tempore voluptatibus, autem quas minus, maiores similique quam aliquid. Sunt eius hic magnam aspernatur? Reprehenderit id, omnis, magni debitis itaque alias perferendis totam quos, dolorum praesentium eligendi. Eligendi totam architecto minima et? Praesentium est ducimus commodi animi odio, fugit voluptate saepe distinctio ad necessitatibus! Consectetur reprehenderit eum sunt neque. Nobis quo nihil quis quia distinctio neque nesciunt voluptatem error cum cupiditate ea adipisci placeat, tempore nam odio aut corrupti architecto perspiciatis minima repellendus? Autem. Veniam distinctio molestias veritatis ipsam aspernatur, officiis cum modi. Fugit deleniti quos, delectus eligendi voluptatibus nulla soluta voluptates, porro perferendis adipisci laborum quis labore? Molestias aliquam sunt quia architecto nesciunt? Dolores eaque maiores voluptates repellendus accusamus? Ad doloremque iure ipsa odio eligendi, sint, asperiores laudantium quo magni exercitationem reprehenderit iusto adipisci quod neque velit, dignissimos reiciendis pariatur aspernatur suscipit placeat! Tempore ipsam explicabo nihil obcaecati, sint alias possimus velit asperiores soluta impedit praesentium excepturi debitis inventore dolorum laudantium doloremque minima quod unde animi, cupiditate earum libero corrupti vero. Dicta, labore. Dolorem, dolores minus nesciunt exercitationem nobis atque delectus, corrupti consectetur earum odit architecto omnis provident impedit ullam magnam! Adipisci perspiciatis laboriosam facilis tempora, provident voluptate optio distinctio aspernatur eius repudiandae. Totam magnam porro quis nulla illum maxime officia ipsum, sunt ab eligendi quae ipsam atque nihil facere eos unde ipsa. Asperiores voluptatem non unde, voluptatibus maiores error perspiciatis autem exercitationem! Necessitatibus doloremque, tempore explicabo ipsa officiis veritatis dolorem labore nulla beatae officia tenetur non repellat! Atque, alias in! Vitae delectus ipsum voluptates velit ab repellat omnis aliquam, asperiores fuga voluptatibus. Magnam, impedit inventore quidem earum illo expedita vitae natus numquam non cumque perspiciatis similique. Quis distinctio soluta delectus impedit eveniet dolores ad sint, quam nemo, ea laborum inventore eligendi dolorum! Nihil, odio? Nobis inventore quod magnam neque ullam recusandae molestias provident repellat porro enim asperiores, nostrum voluptate sunt ipsa velit pariatur magni veritatis iusto? Harum quas qui ab dicta sequi. Aut ad rem debitis recusandae, quae sit. Deserunt illo qui molestias eum nisi voluptas molestiae repudiandae unde magnam corporis alias saepe delectus ea maiores reprehenderit, itaque, eaque perspiciatis dignissimos sapiente! Ipsa earum debitis corporis consequatur sint, animi eaque. Necessitatibus provident doloremque tempore corrupti, illo qui velit est iure voluptas aliquid at quibusdam repellat voluptatem incidunt, enim deserunt aliquam autem ex. Ad earum, iusto eum, quia id dicta assumenda at eligendi repellendus nihil totam corporis dolor, quo dolore distinctio. Iure officia vitae veniam beatae, modi totam accusantium dolor animi id iusto! Non cupiditate officia dolore reprehenderit harum iste, assumenda laborum iure dicta eum. Doloremque quaerat voluptatem sit. Eum aspernatur est soluta fuga, temporibus fugiat velit accusantium voluptate ullam quidem architecto nobis. A quod accusamus recusandae eligendi minima, aliquid nesciunt consectetur ea delectus sequi eum libero quisquam. Commodi, atque ipsa! Totam explicabo libero deserunt et minus sapiente quos optio dolorem numquam ipsum? Odio sed, consectetur asperiores dignissimos iure ad ipsa non exercitationem corporis alias laborum hic corrupti ratione blanditiis! Rerum, ut asperiores! Magnam sint optio aliquid ipsum aliquam! Doloremque repellendus beatae modi. Iste, ea quia quis, nobis ad a facilis dicta provident sint cumque dolorem possimus doloremque iusto earum doloribus at. Laboriosam dolorum, praesentium animi et delectus sint officia libero magni dolorem. Natus vel voluptatum molestiae. Tenetur fugit odio unde repellendus atque eaque veritatis deserunt tempora enim ea expedita nostrum velit, consectetur perferendis. Ea odit explicabo adipisci tempore quo assumenda dicta quisquam? Iure earum veniam quasi dolorum debitis provident eius nisi praesentium, voluptatibus hic consequatur incidunt atque? Dolorum, porro quasi nam deleniti eius dicta unde deserunt quisquam distinctio! Nemo explicabo repellat a. Cumque atque itaque numquam necessitatibus a veniam consequatur sequi at maiores in ducimus, deserunt, similique voluptates esse eius dolore incidunt possimus nostrum unde cupiditate? Amet sunt neque expedita sint perferendis. Vel in quod eos dolorum obcaecati laborum. Quod repellat nisi eligendi, laudantium fuga, veniam neque, facilis nesciunt cumque odio autem sit quia quo. Nostrum, quos perferendis iure ullam illum fugit. Iste, quibusdam aspernatur accusantium maiores alias expedita sint voluptas ab, ratione quisquam natus, placeat voluptatibus quam blanditiis ex provident illum delectus officia ad esse sunt? Laboriosam magni officia ea at. Dolor, reiciendis perferendis! Fuga, aliquam autem eius blanditiis fugit obcaecati explicabo sint veniam minima quam, quasi laborum est praesentium facilis vel reprehenderit maiores assumenda soluta repellendus labore provident cupiditate voluptatibus. Illo quibusdam consectetur illum eaque eius minima veritatis earum rerum minus doloribus nobis, consequatur recusandae unde natus iusto qui, dignissimos veniam neque expedita debitis temporibus! Dolorum quam quo sapiente nemo! Laborum nostrum quasi neque hic architecto veniam, at illo, ratione dolores aut suscipit a labore impedit cupiditate? Consequatur, accusamus corrupti ad, earum facilis, illo cumque sunt nisi doloribus dicta molestiae? Assumenda delectus, voluptas accusantium numquam enim corrupti libero ullam ipsa aliquid voluptate architecto repellat vero facere perferendis incidunt eaque? Doloribus accusantium consequuntur facere nihil est deserunt deleniti fugit eius velit. Porro illum a perferendis expedita similique molestiae quaerat qui, nisi doloremque cum facere animi at impedit ipsum dolorem minus nostrum ad nesciunt ut dolores est voluptatem placeat nobis repellat! Distinctio! Fugiat iusto quis reiciendis omnis pariatur, a accusamus accusantium, itaque nostrum tempore atque commodi excepturi! Adipisci, eligendi tenetur ex sunt illum quae commodi dignissimos, numquam ad aliquid officia. Sunt, amet! Laudantium, beatae nemo. Id delectus ratione, ducimus iusto quibusdam soluta laboriosam nesciunt eaque consequuntur repellat eius aut in placeat a esse explicabo. Illum eveniet quaerat ab harum dolorem accusantium veritatis? Culpa ipsam impedit odit ut atque, itaque rerum non aliquid voluptate aspernatur eveniet nesciunt. Nam odio, dolorum aperiam labore ipsa non sed ad mollitia, unde exercitationem debitis perspiciatis repudiandae harum. Libero tempore aliquid, ea similique pariatur deleniti ipsa ab nam repellat laboriosam suscipit sit delectus doloribus veniam et eligendi quas, qui placeat modi ipsam vel. Ipsam nisi necessitatibus suscipit libero! Libero, error eius. Facilis provident sapiente exercitationem, consectetur qui doloremque id totam. Excepturi illo error praesentium ducimus voluptatem, earum quas iusto iste dignissimos deleniti sunt, dolorum accusamus minima quia unde? Blanditiis ratione amet aliquid repudiandae commodi repellat perspiciatis expedita laudantium sit, soluta, debitis obcaecati, accusantium reprehenderit voluptates quisquam distinctio doloribus. Ab accusantium culpa reiciendis quis repellat sequi architecto similique quo? Corrupti obcaecati soluta dolorum sunt repudiandae magnam similique, saepe, autem eum, repellendus quis dolorem explicabo ipsum et necessitatibus optio eaque facere esse. Deleniti, quia doloribus. Voluptatibus impedit architecto consectetur aut. Expedita nostrum sit praesentium hic eveniet accusamus tempore fugiat. Voluptatum quia error sunt enim. Aperiam, magnam similique! Sed, totam asperiores maiores pariatur explicabo consequatur nam minus incidunt? Libero, nulla quod. Cumque, libero perspiciatis! Harum voluptates voluptatem quas eius mollitia qui, rerum ea obcaecati illum minima dolorum deleniti sint hic omnis nihil maxime minus dolores reiciendis iusto! Dicta doloribus amet rem? Pariatur esse voluptates quasi vitae delectus possimus in, veniam non error dolorum quaerat consequuntur, nisi inventore libero accusantium dolor laborum itaque, adipisci quo tempora officia dicta et eligendi? Non, est. Animi cum necessitatibus, quo, quod consectetur ex dolorem quas nihil recusandae quaerat deserunt voluptatem porro aperiam qui sapiente aliquid magni laborum eum nisi asperiores et. Eaque quidem suscipit sit quam. Quasi eaque doloremque facilis assumenda provident quos ea, nobis ratione maxime officia eveniet ducimus quis numquam perspiciatis iure. Quod earum vero amet dolorem ipsum ea hic assumenda atque repellendus soluta! Sequi exercitationem, cum mollitia beatae, eum perferendis reprehenderit ullam ducimus quia dolores fuga labore quis recusandae saepe quibusdam voluptates totam necessitatibus, culpa quasi ea repudiandae sunt dicta magni. Pariatur, ad! Expedita natus officiis dolor. Qui ut nulla sunt. Maiores quod ipsa corporis. Quas consectetur unde neque alias, ipsum repudiandae accusantium facere ullam, deserunt nesciunt animi cupiditate modi vero beatae numquam. Dolorem quam adipisci, soluta nobis officiis beatae ea natus dolor ipsam et cum eius, tempore tenetur corrupti maxime sunt molestiae vero? Tempora neque maiores optio odio dolorum quisquam error at! Adipisci dolore dolorem obcaecati voluptate ea earum, odit quisquam ipsam. Ipsa corporis deleniti blanditiis, consectetur nostrum, itaque totam nesciunt, dicta reiciendis laboriosam temporibus eaque maxime commodi facilis facere magni accusamus. In quod fuga alias non qui quibusdam minus facilis mollitia est labore, odit tenetur aliquid adipisci obcaecati, iusto debitis quisquam. Hic ad rem ea obcaecati non aliquid quasi esse sed. Porro veniam odio esse maiores quis illo sequi perspiciatis, dignissimos, repellendus ad officia quae impedit beatae officiis! Non commodi deleniti id ipsa suscipit itaque vitae, rerum provident omnis cumque voluptatibus! Labore porro nulla voluptatibus quos, iure amet impedit numquam eaque sapiente. Adipisci temporibus quasi voluptates rerum hic dolor aperiam vitae in, neque corporis id officiis impedit harum. Voluptatum, maiores porro. Delectus voluptates dignissimos, tempore temporibus aperiam cumque quaerat maiores non, sint magni voluptatum! Eaque distinctio libero, et eligendi quos officiis voluptate quo sequi magnam aliquid quod blanditiis qui excepturi facere! Obcaecati, nisi! Vitae tenetur voluptatibus facilis corporis odio blanditiis? Veniam natus ipsam, unde sit dicta eveniet nobis minima voluptatibus itaque possimus illum obcaecati, officia veritatis doloremque quos impedit hic mollitia. Quos rerum atque magni at placeat, libero corrupti ipsum deserunt culpa doloremque odio, quibusdam nesciunt cupiditate eligendi. Blanditiis, ratione consectetur debitis nisi mollitia ea, harum magni dolore, facere totam dolores. Nulla voluptas et repellendus unde, enim iure fugiat esse quia architecto porro totam commodi. Ea necessitatibus non facere. Distinctio facilis nobis deserunt aspernatur aliquid tenetur eaque! Repudiandae molestias in cumque. Fugiat mollitia iste, enim ut, corrupti aut repellendus accusamus hic veniam tempora at esse perferendis distinctio rerum sunt fuga modi, ipsam ex minima eaque. A omnis nemo distinctio quibusdam quasi. Incidunt, enim voluptatem est impedit dolorum assumenda atque labore consequuntur sit tempore animi vero quas, ab earum illo omnis expedita explicabo ipsam maiores ratione, vitae quibusdam? Dignissimos, error? Delectus, similique. Amet quae corporis tenetur odit ipsa fuga possimus iste aliquid quam omnis minima ipsum quasi, ad cum praesentium sequi suscipit incidunt sunt, aperiam ab natus a, rerum modi soluta! Officia. Expedita molestias obcaecati corrupti autem temporibus, voluptate sequi quae, laboriosam illo totam id quidem, beatae dolore eum natus sed officiis! Quibusdam dolorem nam eius, consequatur consectetur itaque aspernatur asperiores. Voluptas. Ipsa, itaque eveniet odio reiciendis sit expedita quaerat eligendi cupiditate! Nostrum, fuga. Molestiae aspernatur illo ducimus, modi laborum iste explicabo, iure molestias esse voluptate voluptas repudiandae dignissimos ratione. Ad, perspiciatis. Delectus accusamus quasi quibusdam amet sit? Fugiat quas, voluptates quisquam velit laboriosam quae animi delectus, voluptatibus eius eos distinctio! Provident possimus molestias nostrum quo cum nesciunt voluptatum assumenda fugit quidem? Rem nesciunt quaerat quibusdam magni dolorum obcaecati doloremque necessitatibus voluptates tempora ut voluptatum atque repellat ad deleniti facere saepe quod, eligendi, sed quae eius! Eligendi explicabo voluptate eaque quaerat cumque! Maiores, expedita error culpa nemo atque in odio dolorem ducimus qui? Dolores sed dolore ullam inventore in. Ratione dolor officia tenetur aperiam laudantium, sit nihil corrupti quod asperiores autem esse? Unde qui, repudiandae eum veniam cupiditate excepturi minus ducimus officia! Ea iusto quibusdam aliquid nam, ex debitis. Aliquid reprehenderit ex aliquam voluptatibus similique ratione nobis, architecto, numquam officiis est laboriosam. Exercitationem, maiores voluptate? Dolores enim fugiat velit sed voluptas dolorem excepturi omnis impedit beatae sapiente voluptatem facere provident perspiciatis earum et numquam neque iste cupiditate tempora, quaerat porro ea. Voluptatem. Eligendi quam itaque illo praesentium delectus natus? Magni perspiciatis, deleniti eligendi eos fuga saepe accusantium hic praesentium dolore illo incidunt alias, aspernatur modi natus, non quibusdam? Quaerat magnam fugiat deserunt. Unde cumque ratione voluptatibus voluptas iste qui, deserunt, similique sit ullam fugiat aliquid eos eligendi. At blanditiis pariatur dolore culpa nemo optio, obcaecati tempore assumenda, aspernatur quod doloribus magnam minus! Consectetur illo consequatur quidem dolorum nam! Laudantium, quae rem esse aliquam dolor, possimus, itaque ratione eos beatae error vitae a perspiciatis ullam incidunt. Harum reiciendis suscipit officiis perferendis alias obcaecati! Nostrum ullam veritatis inventore rerum, voluptates repellendus corporis quibusdam, quos molestiae fugiat quasi vitae voluptatibus dolor? Sint facere quas corporis fugit non sed placeat tempore et est quasi, corrupti nulla? Doloribus, nisi quos. Rerum architecto error saepe placeat, labore tempora possimus. Voluptatem, tenetur, cum minima, repellendus natus tempore culpa blanditiis quis ullam deserunt saepe placeat sit sequi ducimus ad! Laboriosam. Nesciunt commodi autem laudantium adipisci pariatur non corrupti modi recusandae et nemo, fugit at dolore saepe, dolor eligendi impedit facere suscipit eius repudiandae quos sequi molestias voluptatem magnam. Earum, alias. Ab facere iste voluptatum hic quas architecto magni aliquid repellendus nostrum earum veniam odit suscipit molestiae laudantium commodi quam harum est, aut voluptatibus voluptate rem? Saepe ipsa porro explicabo illum? Eum, animi voluptates dolores incidunt mollitia blanditiis amet, nam eaque id quod possimus voluptatibus! Minus totam eaque et magni quibusdam, vitae ab earum velit aliquid at perspiciatis accusantium ex vel. Quasi accusantium delectus distinctio eveniet pariatur, suscipit a laborum incidunt nam esse iusto, doloremque est quia ratione fuga quisquam asperiores harum illum magni eos! Est doloribus mollitia corrupti consequatur aliquam! Officia quos ipsam cupiditate expedita magni! Esse eum veritatis voluptas expedita aliquam explicabo blanditiis nam unde odit quas autem deserunt incidunt excepturi quo ea dolores tempora illo, rerum at vel! Nisi soluta dolor omnis repudiandae praesentium fugit rerum illo corporis quia, maiores optio eius consequuntur earum quaerat! Aliquid exercitationem repudiandae nostrum facilis quos accusamus rerum explicabo amet asperiores, odio quis. Autem tenetur in cupiditate alias? Esse facilis voluptatem architecto non labore voluptates ex quidem consectetur fugiat? Sed odio facere deleniti nulla rem iste consequatur explicabo quis vero, tempora quos repellat. Quia sapiente dolorum officia nobis delectus porro earum aut, recusandae voluptatum consequuntur ipsum accusamus perspiciatis blanditiis dolore quas reiciendis ipsa officiis soluta! Amet impedit ipsum dolores cum similique earum qui? Nam velit doloribus impedit sapiente pariatur similique, soluta, expedita quia autem harum deleniti suscipit eaque aspernatur. Iste deleniti repellendus, a excepturi ipsa fugiat, officia asperiores quos quaerat, tenetur consequuntur sunt. Reiciendis distinctio aliquam quis reprehenderit, dolorem molestias mollitia, corrupti delectus aut ratione exercitationem ab vitae enim laboriosam dolor. Deserunt optio quidem ipsa doloremque ullam eos necessitatibus similique? Repellat, commodi nesciunt. Sint libero voluptates quibusdam voluptate consectetur tempore delectus eaque asperiores tenetur nihil laborum, fugiat cum iusto facere et error, maiores nam eum facilis temporibus nesciunt corrupti labore. Maxime, deleniti enim. Incidunt id culpa ipsam aliquid asperiores quaerat saepe deserunt, qui, doloremque nobis eius iste quidem. Voluptatem exercitationem possimus neque eaque quia quaerat esse perspiciatis, itaque dolorem, corrupti incidunt omnis facere! Laborum commodi doloremque veritatis, rerum dolore nemo at rem adipisci non ullam maxime quibusdam molestias amet fuga magni consequatur eaque nulla. Maiores natus maxime beatae dolore iste eligendi nisi deleniti. Blanditiis commodi sed ratione tenetur hic fuga aliquid reprehenderit voluptatibus, ab consectetur voluptatum eveniet est iste! Sint accusantium, id laborum commodi illum odio rerum perferendis beatae, quo, error aut? Exercitationem. Recusandae atque eligendi molestias consectetur vitae provident sint minus, consequatur nemo, omnis deserunt non, optio aspernatur repellat at corporis officiis ad quas. Ipsam corrupti optio praesentium, sit iure saepe aliquam. Adipisci voluptatum doloremque quo aliquid ea perspiciatis veritatis. Modi repellendus culpa dolores consequatur libero, facilis in, molestiae deleniti aspernatur nulla enim sed, expedita eos minus voluptatum voluptatibus dolore asperiores! Autem? Dolor omnis pariatur veniam perspiciatis tempora cupiditate quas repudiandae necessitatibus sint deleniti, placeat tempore illo, distinctio officiis. At praesentium laborum id dolore ex a temporibus voluptatem. Quae laborum itaque voluptatum! Placeat, laudantium odit. Quo sit, amet quaerat porro praesentium ut rem aspernatur, dicta rerum velit maxime molestiae earum nihil. Corporis vel repellendus blanditiis aliquid a? Corporis ipsam itaque odio quas. Ad, reprehenderit sint labore tenetur ea distinctio aliquam maxime deleniti mollitia minus quidem unde doloribus blanditiis illo eos accusamus eum itaque fugiat alias adipisci perspiciatis? Molestias aspernatur ipsam quaerat vero? Magni, magnam. Natus minus nemo libero vero soluta incidunt, distinctio earum ea autem beatae reiciendis accusamus! Odio magni ipsa hic, adipisci laboriosam illum quae, laudantium, a asperiores laborum nisi voluptas!",
			published: true,
			category: "opinions",
			subcategory: "urmom",
			authors: ["sigma"],
			month: 1,
			year: 2025,
			img: "../../../../assets/default.png", //i lowk forgor where public was... so this works ig
			featured: false,
			markdown: false,
			contentInfo: null,
		};

	const parsedId = parseInt(id);
	const isIdValid = !isNaN(parsedId) && id !== "null";
	const titleFromSlug = decodeURIComponent(slug.split("-").slice(0, -1).join(" "));

	const art = isIdValid
		? await prisma.article.findFirst({
				where: {
					id: parsedId,
					published: true,
				},
		  })
		: await prisma.article.findFirst({
				where: {
					year: parseInt(year),
					month: parseInt(month),
					category: cat,
					title: {
						equals: titleFromSlug,
						mode: "insensitive",
					},
					published: true,
				},
		  });

	return art;
}

export async function getCurrArticles() {
	if (!prisma) return [];
	const curr = new Date();
	let month = curr.getMonth() + 1;
	let year = curr.getFullYear();

	let articles = await getArticlesByDateOld(year.toString(), month.toString());
	while (articles.length === 0) {
		month--;
		if (month === 0) {
			month = 12;
			year--;
		}
		articles = await getArticlesByDateOld(year.toString(), month.toString());
	}

	return articles;
}

export async function getArticlesByDateOld(year: string, month: string) {
	if (!prisma) return [];
	let articles: article[] = [];

	articles = await prisma.article.findMany({
		orderBy: [
			{
				id: "desc",
			},
		],
		where: {
			year: parseInt(year),
			month: parseInt(month),
			published: true,
		},
	});

	return articles;
}

export async function getArticlesByDate(year: string, month: string) {
	let articles: Record<string, article[]> = { "news-features": [], opinions: [], "arts-entertainment": [], sports: [] };
	const categories = Object.keys(articles);

	if (!prisma) return articles;

	for (let category of categories) {
		articles[category] = await prisma.article.findMany({
			orderBy: [
				{
					id: "asc",
				},
			],
			where: {
				year: parseInt(year),
				month: parseInt(month),
				published: true,
				category: category,
			},
		});
	}

	return articles;
}

export async function getIdOfNewest(cat: string, subcat: string | null) {
	if (!prisma) return 0;

	let res;
	if (cat == "spreads") {
		res = await prisma.spreads.findFirst({
			orderBy: [{ year: "desc" }, { month: "desc" }, { id: "desc" }],
			where: {
				category: subcat != null ? subcat : "",
			},
			select: {
				id: true,
			},
		});
	} else if (cat == "multimedia") {
		subcat = subcat == null ? "youtube" : subcat;
		res = await prisma.multimedia.findFirst({
			orderBy: [{ year: "desc" }, { month: "desc" }, { id: "desc" }],
			where: {
				format: subcat,
			},
			select: {
				id: true,
			},
		});
	} else {
		const where = subcat == null ? { category: cat, published: true } : { category: cat, subcategory: subcat, published: true };

		res = await prisma.article.findFirst({
			orderBy: [
				{
					year: "desc",
				},
				{
					month: "desc",
				},
				{
					id: "desc",
				},
			],
			where,
			select: {
				id: true,
			},
		});
	}

	return res === null ? 0 : res.id;
}

export async function getArticlesByCategory(cat: string, take: number, offsetCursor: number, skip: number) {
	if (!prisma) return [];

	const articles = await prisma.article.findMany({
		orderBy: [
			{
				year: "desc",
			},
			{
				month: "desc",
			},
			{
				id: "desc",
			},
		],
		where: {
			category: cat,
			published: true,
		},
		take,
		cursor: offsetCursor ? { id: offsetCursor } : undefined,
		skip,
	});

	return articles;
}

export async function getArticlesExceptCategory(cat: string) {
	let articles: any[] = [];
	if (!prisma) return articles;
	let cats = ["news-features", "arts-entertainment", "opinions", "sports", "multimedia"];

	for (let i = 0; i < cats.length; i++) {
		// TODO: use foreach but make it actually work
		let c = cats[i];
		if (c == cat) continue;
		let id = await getIdOfNewest(c, c);
		let cArticles = await getArticlesByCategory(c, 2, Number(id), 0);
		articles.push(...cArticles);
	}

	return articles;
}

export async function getArticlesBySearch(query: string | string[]) {
	const safeQuery = Array.isArray(query) ? query[0] : query;
	if (!prisma) return [];
	if (!safeQuery || !safeQuery.trim()) return [];

	// Case-insensitive partial match for names inside the authors[] array
	const likeParam = `%${safeQuery.replace(/[%_]/g, s => "\\" + s)}%`;
	const authorIdRows = await prisma.$queryRaw<{ id: number }[]>`
		SELECT id
		FROM "article"
		WHERE EXISTS (
			SELECT 1
			FROM unnest("authors") AS a(name)
			WHERE a.name ILIKE ${likeParam}
		)
	`;
	const authorIds = authorIdRows.map(r => r.id);

	// Build OR conditions, including case-insensitive text search and author matches
	const orConditions: Prisma.articleWhereInput[] = [
		{
			title: {
				contains: safeQuery,
				mode: "insensitive",
			},
		},
		{
			content: {
				contains: safeQuery,
				mode: "insensitive",
			},
		},
		{
			contentInfo: {
				contains: safeQuery,
				mode: "insensitive",
			},
		},
	];

	if (authorIds.length) {
		orConditions.push({ id: { in: authorIds } });
	}

	return await prisma.article.findMany({
		where: {
			OR: orConditions,
		},
		orderBy: {
			id: "desc",
		},
	});
}

export async function getArticlesBySubcategory(subcat: string, take: number, offsetCursor: number, skip: number) {
	if (!prisma) return [];
	const articles = await prisma.article.findMany({
		orderBy: [
			{
				year: "desc",
			},
			{
				month: "desc",
			},
		],
		where: {
			subcategory: subcat,
			published: true,
		},
		take: take,
		cursor: {
			id: offsetCursor,
		},
		skip: skip,
	});

	return articles;
}

export async function getArticlesByAuthor(author: string) {
	if (!prisma) return [];
	const decoded = decodeURI(author).trim();
	if (!decoded) return [];

	// 1) Strict author match: exact name in authors[] (case-insensitive)
	const exactAuthorRows = await prisma.$queryRaw<{ id: number }[]>`
        SELECT id
        FROM "article"
        WHERE published = true
        AND EXISTS (
            SELECT 1
            FROM unnest("authors") AS a(name)
            WHERE lower(a.name) = lower(${decoded})
        )
    `;

	// 2) Photo credit match: content-info begins with Photo/Image/Graphic and contains the name
	const photoCreditRows = await prisma.$queryRaw<{ id: number }[]>`
        SELECT id
        FROM "article"
        WHERE published = true
        AND "content-info" IS NOT NULL
        AND "content-info" ~* '^(photo|image|graphic)\s*:'
        AND "content-info" ILIKE '%' || ${decoded} || '%'
    `;

	const ids = Array.from(new Set([...exactAuthorRows.map(r => r.id), ...photoCreditRows.map(r => r.id)]));

	if (!ids.length) return [];

	return await prisma.article.findMany({
		where: { id: { in: ids } },
		orderBy: [{ year: "desc" }, { month: "desc" }, { id: "desc" }],
	});
}

export async function getSpreadsByCategory(category: string, take: number, offsetCursor: number, skip: number) {
	if (!prisma) return [];

	if (!take) take = 1;

	const spreads = await prisma.spreads.findMany({
		orderBy: [
			{
				year: "desc",
			},
			{
				month: "desc",
			},
		],
		where: {
			category,
		},
		take,
		cursor: {
			id: offsetCursor,
		},
		skip,
	});

	return spreads;
}

export async function getSpread(slug: string) {
	if (!prisma) return null;

	const spreads = await prisma.spreads.findFirst({
		where: {
			title: decodeURI(slug),
		},
	});

	return spreads;
}

export async function getCurrentCrossword(): Promise<PuzzleInput> {
	if (!prisma) throw new Error("lol no");

	const crossword = (await prisma.crossword.findFirst({ orderBy: { date: "desc" } }))!;
	return {
		author: crossword.author,
		clues: JSON.parse(crossword.clues),
		date: crossword.date.toISOString(),
	};
}

export async function getCrosswords(take: number, offsetCursor: number, skip: number) {
	if (!prisma) throw new Error("lol no");
	const crosswords = await prisma.crossword.findMany({
		orderBy: [{ date: "desc" }],
		cursor: {
			id: offsetCursor,
		},
		take,
		skip,
		select: {
			author: true,
			date: true,
			id: true,
		},
	});

	return crosswords.map(c => ({ author: c.author, id: c.id, date: c.date.toLocaleDateString() }));
}

export async function getIdOfNewestCrossword() {
	if (!prisma) throw new Error("lol no");
	return (await prisma.crossword.findFirst({ orderBy: { date: "desc" }, select: { id: true } }))?.id || 1;
}

export async function getCrosswordById(id: number) {
	if (!prisma) throw new Error("lol no");
	const crossword = await prisma.crossword.findFirst({ where: { id } });
	if (!crossword) return null;
	return {
		author: crossword.author,
		date: crossword.date.toLocaleDateString(),
		clues: JSON.parse(crossword.clues),
	};
}

export async function getMultiItems(format: string, take: number, offsetCursor: number, skip: number) {
	if (!prisma) return [];
	const items = await prisma.multimedia.findMany({
		orderBy: [{ year: "desc" }, { month: "desc" }, { id: "desc" }],
		where: {
			format: format,
		},
		take: take,
		cursor: {
			id: offsetCursor,
		},
		skip: skip,
	});

	return items;
}

export async function uploadArticle(info: {
	title: string;
	authors: string[];
	category: string;
	subcategory: string;
	month: number;
	year: number;
	img: string;
	content: string;
}) {
	if (!prisma) throw new Error("no!");
	console.log("uploadArticle called");
	await prisma.article.create({ data: info });
	console.log("upload complete from uploadArticle");
}

export async function uploadSpread(info: { title: string; src: string; month: number; year: number; category: string }) {
	if (!prisma) throw new Error("npoe");
	await prisma.spreads.create({ data: info });
}

export async function uploadMulti(info: { format: string; src_id: string; month: number; year: number; title: string }) {
	if (!prisma) throw new Error("no");
	await prisma.multimedia.create({ data: info });
}

export async function uploadFile(file: formidable.File, bucket: string) {
	if (!supabase) throw new Error("not happening");

	const fileContent = await readFile(file.filepath);
	const originalName = file.originalFilename || "upload";
	const mimeType = file.mimetype || "application/octet-stream";

	// minimal mime → ext map (extend if you need more)
	const EXT_FROM_MIME: Record<string, string> = {
		"image/jpeg": "jpg",
		"image/png": "png",
		"image/gif": "gif",
		"image/webp": "webp",
		"application/pdf": "pdf",
	};

	// try mimetype first; fall back to original filename’s ext; finally "bin"
	const extFromMime = EXT_FROM_MIME[mimeType];
	const extFromName = path.extname(originalName).slice(1).toLowerCase();
	const ext = (extFromMime || extFromName || "bin").replace(/[^a-z0-9]/gi, "") || "bin";

	// sanitize base (strip ext, slugify, trim length)
	const base =
		path
			.basename(originalName, path.extname(originalName))
			.toLowerCase()
			.replace(/[^a-z0-9-_]+/gi, "-")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 60) || "upload";

	// folder by year/month + unique suffix prevents 409s
	const now = new Date();
	const key = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), `${base}-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`].join(
		"/"
	);

	console.log("Uploading to:", bucket, key);

	const { data, error } = await supabase.storage.from(bucket).upload(key, fileContent, { contentType: mimeType, upsert: false });

	if (error) {
		console.error("Could not upload file: ", error);

		// Supabase storage errors sometimes expose `statusCode` (string) or `status` (number)
		// @ts-ignore
		const status = error.status ?? error.statusCode ?? 500;
		if (String(status) === "409") {
			return { code: 409, message: "A file with that name already exists. (Key collision)" };
		}
		// @ts-ignore
		return { code: Number(status) || 500, message: `${error.name || "UploadError"}: ${error.message}` };
	}

	const pub = supabase.storage.from(bucket).getPublicUrl(data.path);
	return { code: 200, message: pub.data.publicUrl };
}
