-- Public key lookup returns only routing information for the exact presented key.
CREATE POLICY channel_public_lookup ON channels FOR SELECT USING(public_key=current_setting('app.public_key',true));
CREATE UNIQUE INDEX visitor_one_conversation ON conversations(workspace_id,channel_id,visitor_id);
