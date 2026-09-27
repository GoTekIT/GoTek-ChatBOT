# H13 Contact messaging decision

A manually created CRM contact does not currently identify a channel or conversation. The existing conversation model requires `channel_id`, and widget sessions create the visitor/conversation pair from a real channel. H13.05 must therefore resolve channel selection from the HiChat evidence before implementation. If no eligible inbox exists, the UI/API must return the documented “Không có hộp thư nào để bắt đầu…” state and must not create a synthetic conversation. No default channel is inferred.

The existing `GET /api/channels` endpoint is the source for channel selection: it is workspace-scoped and filters channels by active membership for non-Owner/Admin users. H13.05 should consume that endpoint, then create a conversation only after the user selects an eligible channel.
