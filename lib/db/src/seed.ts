import { db, issuesTable } from "./index";
import { sql } from "drizzle-orm";

async function seed() {
  const existing = await db.select({ count: sql<number>`count(*)` }).from(issuesTable);
  if (Number(existing[0]?.count) > 0) {
    console.log("Issues already seeded, skipping.");
    return;
  }

  await db.insert(issuesTable).values([
    {
      volume: 1,
      number: "No. 1",
      title: "The Missing Exit",
      tagline: "A Special Edition",
      headline: "BDH-002 · The Last Confirmed Location",
      description:
        "The Biltmore Hotel and the last confirmed location in the Black Dahlia movement record. Press-ready special edition.",
      pdfUrl: "/editions/edition-001-the-missing-exit.pdf",
      pageCount: 12,
      accessLevel: "public",
      status: "archived",
      publishDate: new Date("2026-01-01"),
    },
    {
      volume: 1,
      number: "No. 2",
      title: "Weekly · August 5, 2026",
      tagline: "Published Every Thursday",
      headline: "The Black Dahlia Investigation Continues",
      description:
        "The Black Dahlia investigation. Los Angeles crime, courts and records. Reader tips. Puzzles.",
      pdfUrl: "/editions/edition-002-august-5-2026.pdf",
      pageCount: 12,
      accessLevel: "public",
      status: "published",
      publishDate: new Date("2026-08-05"),
    },
  ]);

  console.log("Seeded 2 issues successfully.");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
