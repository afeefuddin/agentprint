package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/agentprint/agentprint/cli/internal/adapters"
	_ "modernc.org/sqlite"
)

type Store struct {
	database *sql.DB
}

type QueuedRecord struct {
	ID     int64
	Record adapters.UsageRecord
}

func Open(path string) (*Store, error) {
	database, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	database.SetMaxOpenConns(1)
	store := &Store{database: database}
	if err := store.migrate(); err != nil {
		database.Close()
		return nil, err
	}
	return store, nil
}

func (store *Store) migrate() error {
	_, err := store.database.Exec(`
		PRAGMA journal_mode = WAL;
		PRAGMA busy_timeout = 5000;
		CREATE TABLE IF NOT EXISTS source_cursors (
			adapter_id TEXT PRIMARY KEY,
			cursor TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS queue (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			event_id TEXT NOT NULL UNIQUE,
			record_json BLOB NOT NULL,
			created_at TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS sync_attempts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			batch_id TEXT NOT NULL,
			record_ids_json BLOB NOT NULL,
			status TEXT NOT NULL,
			detail TEXT,
			created_at TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS quarantine (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			adapter_id TEXT NOT NULL,
			record_identity TEXT NOT NULL,
			reason TEXT NOT NULL,
			created_at TEXT NOT NULL
		);
	`)
	return err
}

func (store *Store) Close() error { return store.database.Close() }

func (store *Store) Cursor(adapterID string) (string, error) {
	var cursor string
	err := store.database.QueryRow(
		"SELECT cursor FROM source_cursors WHERE adapter_id = ?",
		adapterID,
	).Scan(&cursor)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return cursor, err
}

func (store *Store) Queue(ctx context.Context, adapterID string, records []adapters.UsageRecord, cursor string) (int, error) {
	transaction, err := store.database.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	inserted := 0
	for _, record := range records {
		body, err := json.Marshal(record)
		if err != nil {
			transaction.Rollback()
			return 0, err
		}
		result, err := transaction.ExecContext(ctx,
			`INSERT OR IGNORE INTO queue (event_id, record_json, created_at)
			 VALUES (?, ?, ?)`,
			record.EventID, body, time.Now().UTC().Format(time.RFC3339),
		)
		if err != nil {
			transaction.Rollback()
			return 0, err
		}
		if count, _ := result.RowsAffected(); count == 1 {
			inserted++
		} else if record.ModelID != "" {
			if _, err := transaction.ExecContext(ctx,
				"UPDATE queue SET record_json = ? WHERE event_id = ?",
				body, record.EventID,
			); err != nil {
				transaction.Rollback()
				return 0, err
			}
		}
	}
	_, err = transaction.ExecContext(ctx,
		`INSERT INTO source_cursors (adapter_id, cursor, updated_at)
		 VALUES (?, ?, ?)
		 ON CONFLICT(adapter_id) DO UPDATE SET cursor = excluded.cursor, updated_at = excluded.updated_at`,
		adapterID, cursor, time.Now().UTC().Format(time.RFC3339),
	)
	if err != nil {
		transaction.Rollback()
		return 0, err
	}
	return inserted, transaction.Commit()
}

func (store *Store) Pending(ctx context.Context, limit int) ([]QueuedRecord, error) {
	rows, err := store.database.QueryContext(ctx,
		"SELECT id, record_json FROM queue ORDER BY id LIMIT ?", limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var records []QueuedRecord
	for rows.Next() {
		var item QueuedRecord
		var body []byte
		if err := rows.Scan(&item.ID, &body); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(body, &item.Record); err != nil {
			return nil, err
		}
		records = append(records, item)
	}
	return records, rows.Err()
}

func (store *Store) Acknowledge(ctx context.Context, batchID string, ids []int64, detail string) error {
	transaction, err := store.database.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	encoded, _ := json.Marshal(ids)
	if _, err := transaction.ExecContext(ctx,
		"INSERT INTO sync_attempts (batch_id, record_ids_json, status, detail, created_at) VALUES (?, ?, 'accepted', ?, ?)",
		batchID, encoded, detail, time.Now().UTC().Format(time.RFC3339),
	); err != nil {
		transaction.Rollback()
		return err
	}
	for _, id := range ids {
		if _, err := transaction.ExecContext(ctx, "DELETE FROM queue WHERE id = ?", id); err != nil {
			transaction.Rollback()
			return err
		}
	}
	return transaction.Commit()
}

func (store *Store) PendingCount() (int, error) {
	var count int
	err := store.database.QueryRow("SELECT count(*) FROM queue").Scan(&count)
	return count, err
}

func (store *Store) QuarantineCount() (int, error) {
	var count int
	err := store.database.QueryRow("SELECT count(*) FROM quarantine").Scan(&count)
	return count, err
}
