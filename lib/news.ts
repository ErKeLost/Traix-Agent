export type NewsHeadline = {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
};

const NEWS_FEEDS = [
  {
    url: "https://news.google.com/rss/search?q=bitcoin+OR+ethereum+OR+crypto+market&hl=en-US&gl=US&ceid=US:en",
    source: "Crypto",
  },
  {
    url: "https://news.google.com/rss/search?q=federal+reserve+OR+inflation+OR+interest+rates+OR+oil+market&hl=en-US&gl=US&ceid=US:en",
    source: "Macro",
  },
  {
    url: "https://news.google.com/rss/search?q=iran+OR+israel+OR+war+OR+middle+east&hl=en-US&gl=US&ceid=US:en",
    source: "Geopolitics",
  },
] as const;
const NEWS_TIMEOUT_MS = 4000;

export async function fetchLatestHeadlines() {
  const responses = await Promise.all(
    NEWS_FEEDS.map(async (feed) => {
      try {
        const response = await fetch(feed.url, {
          cache: "no-store",
          headers: {
            Accept: "application/rss+xml, application/xml, text/xml",
          },
          signal: AbortSignal.timeout(NEWS_TIMEOUT_MS),
        });

        if (!response.ok) {
          return [];
        }

        const xml = await response.text();
        return parseRssItems(xml, feed.source);
      } catch {
        return [];
      }
    }),
  );

  const unique = new Map<string, NewsHeadline>();

  for (const items of responses.flat()) {
    if (!unique.has(items.title)) {
      unique.set(items.title, items);
    }
  }

  return Array.from(unique.values()).slice(0, 10);
}

function parseRssItems(xml: string, fallbackSource: string) {
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  return itemMatches
    .map((item) => {
      const title = decodeXml(getTagValue(item, "title"));
      const link = decodeXml(getTagValue(item, "link"));
      const publishedAt = decodeXml(getTagValue(item, "pubDate"));
      const source = decodeXml(getTagValue(item, "source")) || fallbackSource;

      if (!title || !link) {
        return null;
      }

      return {
        title: cleanTitle(title),
        link,
        source,
        publishedAt,
      } satisfies NewsHeadline;
    })
    .filter((item): item is NewsHeadline => Boolean(item));
}

function getTagValue(input: string, tag: string) {
  const match = input.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1] ?? match?.[2] ?? "";
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function cleanTitle(title: string) {
  return title.replace(/\s+-\s+[^-]+$/, "").trim();
}
