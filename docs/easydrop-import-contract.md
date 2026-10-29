# EasyDrop integration contract (STREETSTORE13)

## Confirmed business rules

- The EasyDrop `priceuah` field is the retail price in UAH.
- Markup is **0 UAH**. Import must not add a percentage or fixed surcharge.
- The database stores prices as integer kopiykas, so convert UAH to kopiykas exactly once (`priceuah * 100`) and reject invalid, negative, or non-finite values.
- Each feed `item` represents a size-level stock position. Use the supplier item `id` as the primary external identifier, keep `vendorCode` for diagnostics/matching, and use `group_id` to group sizes of the same model into one product card.
- Use `param[name="Розмір"]` as the EU shoe size. This integration is for shoes only.
- If a supplier item disappears from a successfully validated feed, mark its mapping as not present and hide its product from the public catalog when no active/present supplier variants remain. Do not hard-delete products, variants, mappings, or order snapshots.
- A failed download, invalid XML, malformed feed, or failed validation must not change catalog, stock, or presence flags.
- Stock changes must be idempotent and use the existing inventory journal with reason `IMPORT`.
- Keep the feed URL/key in server-side environment configuration only. Never log the full URL, access key, or raw secret-bearing URL in sync summaries.

## Feed validation and safety requirements

1. Fetch with a strict timeout and response-size limit; only permit approved HTTPS hosts and reject redirects to private/local network destinations (SSRF protection).
2. Parse XML with external entities/DTD disabled.
3. Validate the complete document before writing anything: root, required fields, unique external IDs, price, size, image URL, availability and stock.
4. Produce a preview/diff before applying changes. Applying must be one database transaction or a safely resumable, idempotent operation.
5. Do not set stock to zero merely because a field is missing or malformed. Treat explicit unavailable/zero-stock values according to the validated feed contract.
6. Prevent overlapping runs. Record start/end, status, counts and a sanitized error summary in `supplier_sync_runs`.
7. Daily scheduled sync and an authenticated admin “Sync now” action are later stages; neither is implemented by this foundation migration.

## Scope of this PR

This PR adds persistence for stable supplier-item mappings and sync-run audit records. It intentionally does not download the feed, mutate catalog data, schedule jobs, or expose admin endpoints. Those behaviors should be added in subsequent, testable PRs.
