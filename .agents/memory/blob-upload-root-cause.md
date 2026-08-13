---
name: EdgeOne blob upload root cause
description: Why large file uploads (PDF editions) fail on EdgeOne Pages and the correct fix.
---

## Root cause — large file uploads returning 500

`store.setJSON({ b64: "<base64 buffer>", mimeType, size })` worked for small files but
**consistently fails for PDFs larger than ~5 MB** because:

1. `setJSON` calls `JSON.stringify()` on the object → the base64 string inflates the
   raw file by ~33%.
2. The resulting JSON body is PUT to `blob-nocache.edgeone.site` (the EdgeOne blob CDN
   layer, **not** COS directly).
3. This CDN layer has a document-size limit that 10–40 MB JSON bodies exceed → the PUT
   is rejected → the cloud function's `saveFile` throws → 500 is returned.

## Correct fix (implemented)

Use `store.createUploadUrl(fileKey, { contentType: mimeType, expireSeconds: 300 })` to
get a presigned COS PUT URL, then `fetch(url, { method: "PUT", body: rawBuffer, headers:
{ "Content-Type": mimeType } })`.

**Why this works:**
- The HMAC signature on the presigned URL includes Content-Type, so COS accepts the
  binary PUT with the correct mime type.
- The request goes directly to COS (5 GB object limit), bypassing the blob CDN layer
  entirely — no document-size cap.
- No base64 encoding, no JSON wrapper, no memory inflation.

## getFile compatibility

New blobs are raw binary (start with `%PDF` = 0x25). Legacy blobs from the old
`setJSON` approach start with `{` (0x7B). `getFile` distinguishes them by first byte:
- `bytes[0] === 0x7B` → parse JSON → decode base64 → return Buffer
- otherwise → raw binary → return `Buffer.from(raw)`

## SDK notes (from reading dist/index.js)

- `store.set()`: NO `contentType` option in public API — always sends without Content-Type.
- `store.setJSON()`: hardcodes `contentType: "application/json"` internally.
- `store.createUploadUrl()`: signs Content-Type into the presigned URL HMAC — must send
  the **same** Content-Type header in the subsequent fetch or COS rejects (signature mismatch).
- `store.get(key, { type: "arrayBuffer" })` returns raw Uint8Array bytes regardless of
  stored Content-Type — works for both old JSON and new binary blobs.

**Why:** Any change to how PDFs are stored in `saveFile` must use the presigned URL path.
**How to apply:** Always call `store.createUploadUrl()` for binary files >~1 MB.
