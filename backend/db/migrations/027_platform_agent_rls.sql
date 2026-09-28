DROP POLICY IF EXISTS platform_agent_messages_scope ON platform_agent_messages;
CREATE POLICY platform_agent_messages_scope ON platform_agent_messages
 USING(current_setting('app.platform',true)='true' AND session_id IN (SELECT id FROM platform_agent_sessions WHERE actor_id=nullif(current_setting('app.actor_id',true),'')::uuid))
 WITH CHECK(current_setting('app.platform',true)='true' AND session_id IN (SELECT id FROM platform_agent_sessions WHERE actor_id=nullif(current_setting('app.actor_id',true),'')::uuid));
