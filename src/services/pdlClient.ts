/**
 * People Data Labs (PDL) - B2B contact enrichment
 * Falls back to website scraping when PDL fails or returns no results
 */

import { GENERIC_EMAILS } from "@/lib/constants";

export interface Contact {
  name: string;
  title: string;
  email: string;
  emailQuality: "verified" | "generic" | "unverified" | "none";
  linkedinUrl: string;
  source: "pdl" | "website";
}

async function enrichViaPDL(domain: string): Promise<Contact[]> {
  const apiKey = process.env.PDL_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch("https://api.peopledatalabs.com/v5/person/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({
        query: {
          bool: {
            must: [
              { term: { job_company_website: domain } },
              {
                terms: {
                  job_title_levels: [
                    "director",
                    "vp",
                    "c_suite",
                    "manager",
                    "partner",
                    "owner",
                  ],
                },
              },
              {
                terms: {
                  job_title_role: [
                    "purchasing",
                    "procurement",
                    "supply_chain",
                    "sourcing",
                    "buying",
                    "operations",
                    "trade",
                  ],
                },
              },
            ],
          },
        },
        size: 3,
        dataset: "resume",
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];
    const data = await res.json();

    return (data.data || []).map(
      (person: {
        full_name?: string;
        job_title?: string;
        work_email?: string;
        linkedin_url?: string;
      }) => ({
        name: person.full_name || "",
        title: person.job_title || "",
        email: person.work_email || "",
        emailQuality: person.work_email ? ("verified" as const) : ("none" as const),
        linkedinUrl: person.linkedin_url || "",
        source: "pdl" as const,
      })
    );
  } catch (err) {
    console.warn(
      "[PDL] Failed for",
      domain,
      ":",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function isGenericEmail(email: string): boolean {
  const local = email.split("@")[0].toLowerCase();
  return GENERIC_EMAILS.some((g) => local === g || local.startsWith(g + "."));
}

async function enrichViaWebsite(domain: string): Promise<Contact[]> {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox"],
    });
    const context = await browser.newContext();

    const contacts: Contact[] = [];
    const pagesToCheck = [`https://${domain}/contact`, `https://${domain}/about`];

    for (const pageUrl of pagesToCheck) {
      try {
        const page = await context.newPage();
        await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 10000 });
        const content = await page.content();
        await page.close();

        const emails = content.match(EMAIL_REGEX) || [];
        for (const email of emails.slice(0, 5)) {
          if (contacts.some((c) => c.email === email)) continue;
          contacts.push({
            name: "",
            title: "",
            email,
            emailQuality: isGenericEmail(email) ? "generic" : "unverified",
            linkedinUrl: "",
            source: "website",
          });
        }
      } catch {
        // Page not found or timeout, skip
      }
    }

    await browser.close();
    return contacts.slice(0, 3);
  } catch (err) {
    console.warn("[WebsiteEnrich] Failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

export async function getContacts(domain: string): Promise<Contact[]> {
  // Try PDL first
  const pdlContacts = await enrichViaPDL(domain);
  if (pdlContacts.length > 0) return pdlContacts;

  // Fall back to website scraping
  return enrichViaWebsite(domain);
}

export async function getContactsBatch(
  domains: string[],
  concurrency = 5
): Promise<Map<string, Contact[]>> {
  const results = new Map<string, Contact[]>();
  const batches: string[][] = [];

  for (let i = 0; i < domains.length; i += concurrency) {
    batches.push(domains.slice(i, i + concurrency));
  }

  for (const batch of batches) {
    const batchResults = await Promise.allSettled(
      batch.map(async (domain) => ({ domain, contacts: await getContacts(domain) }))
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled") {
        results.set(r.value.domain, r.value.contacts);
      }
    }
  }

  return results;
}
