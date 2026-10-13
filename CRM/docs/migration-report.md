# Trikonet Migration Report

## Current status

**Not production-ready.** This repository currently contains the Fastonmed CRM application, not the existing Trikonet public frontend or its CMS data. The live Trikonet site remains the visual, content, metadata, and URL source of truth.

## URL baseline

| Check | Result |
| --- | ---: |
| Unique public HTML URLs in live XML sitemaps | 16,986 |
| Targeted for the same URL | 16,986 |
| Intentionally redirected | 0 |
| Missing from inventory | 0 |
| Verified against the completed new application | Pending |

The complete source-to-target mapping is in `docs/existing-url-map.md`. It can be regenerated from the live sitemap with:

```bash
node scripts/crawl-trikonet-urls.mjs
```

All approved exceptions must be recorded in `config/redirects.json` as permanent redirects. It is intentionally empty because no URL changes have been approved.

## Live baseline spot-check

The following representative routes returned HTTP 200 on September 25, 2026:

- `/`
- `/about`
- `/jobs`
- `/employers`
- `/blog`
- `/contact`
- `/pricing`
- `/faq`
- `/submit-job`

## Required completion gates

- [ ] Import or provide the existing Trikonet frontend source, assets, fonts, styles, and animations.
- [ ] Capture reference screenshots at desktop, tablet, and mobile widths.
- [ ] Implement CMS models for pages, jobs, employers, posts, SEO fields, redirects, and reusable existing sections.
- [ ] Preserve existing slugs by default and show an SEO warning before changing a published URL.
- [ ] Automatically add the old path to `config/redirects.json` when a published URL changes.
- [ ] Verify all inventory URLs against the new application: HTTP 200 at the same path or intentional HTTP 301.
- [ ] Validate internal links, images, forms, mobile navigation, metadata, canonicals, sitemap, robots, structured data, Core Web Vitals, 404 behavior, browser console, server logs, and CMS publishing.
- [ ] Repeat visual comparison for every public page template at desktop, tablet, and mobile widths.

The migration must not be marked complete until the missing URL count against the deployed replacement is zero.
