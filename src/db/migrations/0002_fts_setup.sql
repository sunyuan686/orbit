-- FTS5 全文搜索（借鉴 Jant post_fts）
-- trigram 分词支持中文与部分匹配

CREATE VIRTUAL TABLE entry_fts USING fts5(
  title,
  body_text,
  author,
  content='entry',
  content_rowid='rowid',
  tokenize='trigram'
);
--> statement-breakpoint
CREATE TRIGGER entry_fts_ai AFTER INSERT ON entry BEGIN
  INSERT INTO entry_fts(rowid, title, body_text, author)
  VALUES (new.rowid, new.title, new.body_text, new.author);
END;
--> statement-breakpoint
CREATE TRIGGER entry_fts_ad AFTER DELETE ON entry BEGIN
  INSERT INTO entry_fts(entry_fts, rowid, title, body_text, author)
  VALUES ('delete', old.rowid, old.title, old.body_text, old.author);
END;
--> statement-breakpoint
CREATE TRIGGER entry_fts_au AFTER UPDATE ON entry BEGIN
  INSERT INTO entry_fts(entry_fts, rowid, title, body_text, author)
  VALUES ('delete', old.rowid, old.title, old.body_text, old.author);
  INSERT INTO entry_fts(rowid, title, body_text, author)
  VALUES (new.rowid, new.title, new.body_text, new.author);
END;
--> statement-breakpoint
CREATE VIRTUAL TABLE memo_fts USING fts5(
  title,
  body,
  author,
  content='memo',
  content_rowid='rowid',
  tokenize='trigram'
);
--> statement-breakpoint
CREATE TRIGGER memo_fts_ai AFTER INSERT ON memo BEGIN
  INSERT INTO memo_fts(rowid, title, body, author)
  VALUES (new.rowid, new.title, coalesce(new.body, ''), new.author);
END;
--> statement-breakpoint
CREATE TRIGGER memo_fts_ad AFTER DELETE ON memo BEGIN
  INSERT INTO memo_fts(memo_fts, rowid, title, body, author)
  VALUES ('delete', old.rowid, old.title, old.body, old.author);
END;
--> statement-breakpoint
CREATE TRIGGER memo_fts_au AFTER UPDATE ON memo BEGIN
  INSERT INTO memo_fts(memo_fts, rowid, title, body, author)
  VALUES ('delete', old.rowid, old.title, old.body, old.author);
  INSERT INTO memo_fts(rowid, title, body, author)
  VALUES (new.rowid, new.title, coalesce(new.body, ''), new.author);
END;
--> statement-breakpoint
UPDATE entry SET body_text = body WHERE body_text IS NULL AND body IS NOT NULL;
--> statement-breakpoint
INSERT INTO entry_fts(entry_fts) VALUES ('rebuild');
--> statement-breakpoint
INSERT INTO memo_fts(memo_fts) VALUES ('rebuild');
