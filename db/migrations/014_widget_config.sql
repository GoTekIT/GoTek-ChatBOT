ALTER TABLE channels ADD COLUMN IF NOT EXISTS widget_title text NOT NULL DEFAULT 'Trò chuyện';
ALTER TABLE channels ADD COLUMN IF NOT EXISTS widget_position text NOT NULL DEFAULT 'right' CHECK (widget_position IN ('left','right'));
ALTER TABLE channels ADD COLUMN IF NOT EXISTS widget_mode text NOT NULL DEFAULT 'standard' CHECK (widget_mode IN ('standard','expanded'));
