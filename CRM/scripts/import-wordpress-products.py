#!/usr/bin/env python3
"""Extract and merge FastOnMed WooCommerce products without discarding source data."""

from __future__ import annotations

import argparse
import collections
import gzip
import html
import json
import re
import shutil
import zipfile
from pathlib import Path


def sql_value(value: str) -> str:
    if len(value) >= 2 and value[0] == "'" and value[-1] == "'":
        value = value[1:-1]
    return (
        value.replace("\\'", "'")
        .replace('\\"', '"')
        .replace("\\n", "\n")
        .replace("\\r", "\r")
        .replace("\\t", "\t")
        .replace("\\\\", "\\")
    )


def split_fields(group: str) -> list[str]:
    result, buffer = [], []
    quoted = escaped = False
    for char in group:
        if escaped:
            buffer.append(char)
            escaped = False
        elif char == "\\" and quoted:
            buffer.append(char)
            escaped = True
        elif char == "'":
            quoted = not quoted
            buffer.append(char)
        elif char == "," and not quoted:
            result.append("".join(buffer).strip())
            buffer = []
        else:
            buffer.append(char)
    result.append("".join(buffer).strip())
    return result


def split_groups(statement: str) -> list[str]:
    result, buffer = [], []
    quoted = escaped = False
    depth = 0
    for char in statement.rstrip().removesuffix(";"):
        if escaped:
            if depth:
                buffer.append(char)
            escaped = False
        elif char == "\\" and quoted:
            if depth:
                buffer.append(char)
            escaped = True
        elif char == "'":
            quoted = not quoted
            if depth:
                buffer.append(char)
        elif char == "(" and not quoted:
            if depth:
                buffer.append(char)
            depth += 1
        elif char == ")" and not quoted:
            depth -= 1
            if depth == 0:
                result.append("".join(buffer))
                buffer = []
            else:
                buffer.append(char)
        elif depth:
            buffer.append(char)
    return result


def table_rows(dump: Path, table: str):
    prefix = f"INSERT INTO `{table}` VALUES "
    with gzip.open(dump, "rt", encoding="utf-8", errors="replace") as source:
        statement: list[str] | None = None
        for line in source:
            if statement is None:
                if not line.startswith(prefix):
                    continue
                statement = [line[len(prefix) :]]
            else:
                statement.append(line)
            if statement is not None and line.rstrip().endswith(";"):
                for group in split_groups("".join(statement)):
                    yield [sql_value(value) for value in split_fields(group)]
                statement = None


def number(value: str | None) -> float:
    try:
        return float(value or 0)
    except ValueError:
        return 0


def integer(value: str | None) -> int:
    try:
        return int(float(value or 0))
    except ValueError:
        return 0


def plain_text(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value or "")
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def normalize_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True, type=Path)
    parser.add_argument("--uploads", required=True, nargs="+", type=Path)
    parser.add_argument("--crm-root", required=True, type=Path)
    parser.add_argument("--website-root", required=True, type=Path)
    args = parser.parse_args()

    posts: dict[int, dict] = {}
    attachments: dict[int, dict] = {}
    for row in table_rows(args.database, "wp_posts"):
        if len(row) < 23:
            continue
        post_id = integer(row[0])
        record = {
            "wordpressId": post_id,
            "authorId": integer(row[1]),
            "createdAt": row[2],
            "createdAtGmt": row[3],
            "content": row[4],
            "title": row[5],
            "excerpt": row[6],
            "status": row[7],
            "slug": row[11],
            "modifiedAt": row[14],
            "modifiedAtGmt": row[15],
            "parentId": integer(row[17]),
            "guid": row[18],
            "menuOrder": integer(row[19]),
            "postType": row[20],
            "mimeType": row[21],
        }
        if record["postType"] in {"product", "product_variation"}:
            posts[post_id] = record
        elif record["postType"] == "attachment":
            attachments[post_id] = record

    product_meta: dict[int, dict[str, str]] = {post_id: {} for post_id in posts}
    attachment_files: dict[int, str] = {}
    for row in table_rows(args.database, "wp_postmeta"):
        if len(row) < 4:
            continue
        owner_id, key, value = integer(row[1]), row[2], row[3]
        if owner_id in product_meta:
            # Preserve every original product metadata field, including plugin-specific data.
            product_meta[owner_id][key] = value
        if owner_id in attachments and key == "_wp_attached_file":
            attachment_files[owner_id] = value

    terms: dict[int, dict] = {}
    for row in table_rows(args.database, "wp_terms"):
        if len(row) >= 4:
            terms[integer(row[0])] = {"id": integer(row[0]), "name": row[1], "slug": row[2]}

    taxonomy: dict[int, dict] = {}
    for row in table_rows(args.database, "wp_term_taxonomy"):
        if len(row) >= 6:
            taxonomy[integer(row[0])] = {
                "termId": integer(row[1]),
                "taxonomy": row[2],
                "description": row[3],
                "parentId": integer(row[4]),
            }

    relationships: dict[int, list[int]] = collections.defaultdict(list)
    for row in table_rows(args.database, "wp_term_relationships"):
        if len(row) >= 2:
            relationships[integer(row[0])].append(integer(row[1]))

    def assigned_terms(post_id: int, taxonomy_name: str) -> list[dict]:
        found = []
        for taxonomy_id in relationships.get(post_id, []):
            tax = taxonomy.get(taxonomy_id)
            term = terms.get(tax["termId"]) if tax else None
            if tax and term and tax["taxonomy"] == taxonomy_name:
                found.append({**term, "description": tax["description"], "parentId": tax["parentId"]})
        return found

    def media_path(attachment_id: int) -> str:
        relative = attachment_files.get(attachment_id, "").lstrip("/")
        return f"/wp-content/uploads/{relative}" if relative else ""

    extracted: list[dict] = []
    referenced_files: set[str] = set()
    for post_id, post in sorted(posts.items()):
        meta = product_meta[post_id]
        categories = assigned_terms(post_id, "product_cat")
        tags = assigned_terms(post_id, "product_tag")
        brands = assigned_terms(post_id, "product_brand")
        product_types = assigned_terms(post_id, "product_type")
        attributes = {
            tax["taxonomy"]: assigned_terms(post_id, tax["taxonomy"])
            for tax in taxonomy.values()
            if tax["taxonomy"].startswith("pa_") and assigned_terms(post_id, tax["taxonomy"])
        }
        thumbnail_id = integer(meta.get("_thumbnail_id"))
        gallery_ids = [integer(value) for value in meta.get("_product_image_gallery", "").split(",") if value.strip()]
        image = media_path(thumbnail_id)
        gallery = [path for path in (media_path(item) for item in gallery_ids) if path]
        for path in [image, *gallery]:
            if path:
                referenced_files.add(path.removeprefix("/wp-content/uploads/"))

        regular_price = number(meta.get("_regular_price"))
        sale_price = number(meta.get("_sale_price"))
        active_price = number(meta.get("_price")) or sale_price or regular_price
        category_names = [item["name"] for item in categories]
        brand = brands[0]["name"] if brands else meta.get("_brand", "FastOnMed Partner")
        description = plain_text(post["excerpt"] or post["content"])
        extracted.append(
            {
                "id": f"wp-product-{post_id}",
                "name": post["title"],
                "category": category_names[0] if category_names else "Uncategorized",
                "categories": category_names,
                "brand": brand,
                "model": meta.get("_sku", ""),
                "sku": meta.get("_sku", ""),
                "supplier": brand,
                "purchaseCost": number(meta.get("_purchase_price")),
                "sellingPrice": active_price,
                "regularPrice": regular_price,
                "salePrice": sale_price or None,
                "vatStatus": meta.get("_tax_status", "taxable"),
                "warrantyPeriod": meta.get("_warranty_period", ""),
                "amcAvailable": False,
                "specifications": {},
                "inStock": integer(meta.get("_stock")),
                "stockStatus": meta.get("_stock_status", "instock"),
                "manageStock": meta.get("_manage_stock", "no") == "yes",
                "image": image,
                "galleryImages": gallery,
                "description": description,
                "shortDescription": plain_text(post["excerpt"]),
                "tags": [item["name"] for item in tags],
                "slug": post["slug"],
                "status": post["status"],
                "productType": product_types[0]["slug"] if product_types else "simple",
                "createdAt": post["createdAt"],
                "updatedAt": post["modifiedAt"],
                "wordpressSource": {
                    **post,
                    "categories": categories,
                    "tags": tags,
                    "brands": brands,
                    "productTypes": product_types,
                    "attributes": attributes,
                    "metadata": meta,
                    "thumbnailAttachment": attachments.get(thumbnail_id),
                    "galleryAttachments": [attachments[item] for item in gallery_ids if item in attachments],
                },
            }
        )

    data_dir = args.crm_root / "data"
    output_file = data_dir / "products_store.json"
    backup_dir = data_dir / "import-backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    if output_file.exists():
        shutil.copy2(output_file, backup_dir / "products_store.before-wordpress-import.json")
        existing = json.loads(output_file.read_text(encoding="utf-8"))
    else:
        existing = []

    # Merge on normalized product name so CRM-only procurement fields survive.
    existing_by_name = {normalize_name(item.get("name", "")): item for item in existing if item.get("name")}
    merged: list[dict] = []
    imported_names: set[str] = set()
    for product in extracted:
        key = normalize_name(product["name"])
        old = existing_by_name.get(key, {})
        merged.append({**old, **product, "id": old.get("id", product["id"])})
        imported_names.add(key)
    merged.extend(item for item in existing if normalize_name(item.get("name", "")) not in imported_names)
    output_file.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")

    destinations = [
        args.website_root / "public" / "wp-content" / "uploads",
        args.crm_root / "public" / "wp-content" / "uploads",
    ]
    for destination in destinations:
        destination.mkdir(parents=True, exist_ok=True)

    archive_index: dict[str, tuple[Path, str]] = {}
    for archive_path in args.uploads:
        with zipfile.ZipFile(archive_path) as archive:
            for name in archive.namelist():
                if name.startswith("uploads/") and not name.endswith("/"):
                    archive_index.setdefault(name.removeprefix("uploads/"), (archive_path, name))

    copied = missing = 0
    for relative in sorted(referenced_files):
        source = archive_index.get(relative)
        if not source:
            missing += 1
            continue
        archive_path, member = source
        with zipfile.ZipFile(archive_path) as archive:
            content = archive.read(member)
        for destination in destinations:
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
        copied += 1

    report = {
        "sourceDatabase": str(args.database),
        "sourceUploads": [str(path) for path in args.uploads],
        "wordpressProducts": len(extracted),
        "publishedProducts": sum(item["status"] == "publish" and item["wordpressSource"]["postType"] == "product" for item in extracted),
        "variations": sum(item["wordpressSource"]["postType"] == "product_variation" for item in extracted),
        "existingCrmProductsBeforeImport": len(existing),
        "mergedProducts": len(merged),
        "referencedImages": len(referenced_files),
        "copiedImages": copied,
        "missingImages": missing,
        "output": str(output_file),
        "backup": str(backup_dir / "products_store.before-wordpress-import.json"),
    }
    (data_dir / "wordpress-product-import-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
