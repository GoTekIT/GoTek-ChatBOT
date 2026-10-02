-- A receipt must belong to the same source as its message, not merely its tenant.
CREATE FUNCTION check_meta_receipt_source() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM public.messages m JOIN public.conversations c
   ON c.workspace_id=m.workspace_id AND c.id=m.conversation_id
  WHERE m.workspace_id=NEW.workspace_id AND m.id=NEW.message_id
   AND c.connection_id=NEW.connection_id
 ) THEN
  RAISE EXCEPTION 'META_RECEIPT_SOURCE_MISMATCH' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER meta_receipt_source_guard BEFORE INSERT OR UPDATE OF workspace_id,message_id,connection_id
 ON meta_message_deliveries FOR EACH ROW EXECUTE FUNCTION check_meta_receipt_source();

CREATE FUNCTION preserve_conversation_source() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF OLD.connection_id IS DISTINCT FROM NEW.connection_id THEN
  RAISE EXCEPTION 'META_CONVERSATION_SOURCE_IMMUTABLE' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conversation_source_immutable BEFORE UPDATE OF connection_id
 ON conversations FOR EACH ROW EXECUTE FUNCTION preserve_conversation_source();
