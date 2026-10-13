# FastonMed WooCommerce connector

## Install
1. Back up WordPress and test on a staging copy first.
2. Upload `fastonmed-crm-sync.zip` under WordPress → Plugins → Add New → Upload, then activate it with WooCommerce active.
3. Create a dedicated WordPress integration user with the Shop Manager role. In that user's profile create a WordPress Application Password. Use HTTPS and pretty permalinks.
4. Configure these **server-only** environment variables on the deployed Next.js CRM and restart it:

```
WOOCOMMERCE_URL=https://www.fastonmed.com
WOOCOMMERCE_USERNAME=your-integration-user
WOOCOMMERCE_APP_PASSWORD=your-wordpress-application-password
```

5. Open CRM → Products → WooCommerce connection. Sign in to the CRM as an Admin or Super Admin. Click Sync now to import the whole catalogue, not just shop page 2.
6. Enable auto-sync to check every minute while the Products page stays open. Enable “Send unlinked CRM products as shop drafts” only after reviewing your CRM catalogue: it includes existing sample products too. Publish approved drafts in WooCommerce to show them in the shop. Existing published products remain published when edited.

## Supported behavior
- Existing and new WooCommerce products import with description, image, categories, attributes, regular price, stock quantity, SKU and product URL.
- Linked simple products send changed name, description, regular price, stock, image, category and specifications back to WooCommerce.
- Internal costs, supplier margins, contacts and procurement data stay in the CRM.
- Duplicate prevention uses WooCommerce ID / CRM ID; names are never used to merge unrelated products.
- Shop archives using classic WooCommerce hooks gain a 28-word description excerpt. Full descriptions remain on product pages. A block-based or custom Elementor shop template may need its own Product Summary block/widget; this site's template could not be inspected remotely.
- WooCommerce HTML descriptions are converted to plain text for safe CRM display. Unchanged HTML is preserved when other fields are edited. Editing descriptions in the CRM replaces the WooCommerce description with that plain text.
- Products with variants/grouped products import as read-only parent records; variation-level sync is not supported.
- The connector requires an AED shop. It does not convert currencies.
- Product images sent to WordPress must have public HTTPS URLs. Local `/products/...` and browser-uploaded data URLs must first be uploaded to public hosting or WooCommerce media.
- Conflicting simultaneous CRM/shop changes are skipped and named in the panel. Neither version is silently overwritten. Resolve the edits before retrying; do not clear browser storage to resolve a conflict.
- Deletions are not propagated. Sale prices, variation stock, galleries and rich HTML editing are not synchronized.

## Important deployment limits
The current CRM product database is browser-local storage. Automatic sync runs only while the Products page is open and connected. This is not a background multi-user server sync. An always-on sync needs a persistent shared CRM product database and scheduled worker; that infrastructure is not present in this repository. Credentials are not included in the package. No changes have been made to the live WordPress site.

## Validation before production
- Import multiple pages; confirm an existing product retains its WooCommerce ID.
- Edit a simple product's price in CRM; sync and confirm it updates once in WordPress.
- Edit the same product on both sides; confirm a conflict, with neither side overwritten.
- Change a WordPress description and confirm it appears in CRM.
- Add a CRM product with a public HTTPS image; confirm one draft appears after repeated syncs.
- Confirm missing or expired CRM sessions get HTTP 401 and non-admin sessions get HTTP 403.
- Confirm your shop theme shows the excerpt on archive pages and full description on the product page.

TypeScript was checked locally. PHP/WordPress runtime tests require a staging WordPress installation; PHP is not available in this workspace.

The separate FASTONMED_SYNC_PASSWORD is no longer used. The CRM server validates the existing login through /api/auth/me. Set CRM_API_URL if the authentication backend differs from NEXT_PUBLIC_API_BASE_URL.
