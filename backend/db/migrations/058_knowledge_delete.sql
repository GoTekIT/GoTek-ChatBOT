-- Migration 058: Grant DELETE permissions for draft knowledge items
GRANT DELETE ON knowledge_items, knowledge_versions TO gotek_app;
GRANT DELETE ON web_snapshot_knowledge, web_source_generation_parts TO gotek_app;
