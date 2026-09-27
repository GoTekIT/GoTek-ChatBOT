# H11 source generation decision — GoTek backend

Status: design contract, implementation not accepted.

A web source snapshot is immutable. Importing an entry creates one or more INTERNAL, unpublished knowledge drafts and immutable provenance mappings. A later refresh must identify the same source entry and operate as one document generation. It must append new versions to retained items, create parts for growth, and record surplus parts as RETIRE candidates for shrink. It must not clear a currently published pointer during refresh.

A generation publish operation must validate every retained/new version is READY, switch all pointers atomically, retire surplus parts, and record one audit/receipt. Rollback must restore the previous generation atomically. Equal part counts alone are insufficient because source entries can reorder; URL is the canonical identity when available, while URL-less entries require an explicit association.

Until generation and atomic group publish/rollback exist, the current snapshot import endpoint is draft-only and must not be described as full H11.05 parity. This is a GoTek implementation decision derived from the handoff's D2/H11.05 requirement, not an observation of HiChat internals.
