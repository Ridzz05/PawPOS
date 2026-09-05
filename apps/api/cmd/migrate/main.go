package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/config"
)

func main() {
	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		log.Println("DATABASE_URL is not set, skipping migration")
		return
	}

	db, err := sql.Open("pgx", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("failed to ping database: %v", err)
	}

	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version TEXT PRIMARY KEY,
		applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
	)`)
	if err != nil {
		log.Fatalf("failed to create schema_migrations: %v", err)
	}

	migrationsDir := filepath.Join(".", "db", "migrations")
	if _, err := os.Stat(migrationsDir); os.IsNotExist(err) {
		migrationsDir = filepath.Join("..", "db", "migrations")
	}

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		log.Fatalf("failed to read migrations dir: %v", err)
	}

	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	for _, file := range files {
		var exists bool
		err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)", file).Scan(&exists)
		if err != nil {
			log.Fatalf("query version check failed: %v", err)
		}
		if exists {
			fmt.Printf("Migration %s already applied\n", file)
			continue
		}

		content, err := os.ReadFile(filepath.Join(migrationsDir, file))
		if err != nil {
			log.Fatalf("read file %s failed: %v", file, err)
		}

		sqlContent := string(content)
		// Clean up goose directives
		lines := strings.Split(sqlContent, "\n")
		var cleaned []string
		for _, line := range lines {
			trimmed := strings.TrimSpace(line)
			if strings.HasPrefix(trimmed, "-- +goose") {
				continue
			}
			cleaned = append(cleaned, line)
		}
		execSQL := strings.Join(cleaned, "\n")

		tx, err := db.Begin()
		if err != nil {
			log.Fatalf("begin tx failed: %v", err)
		}

		if _, err := tx.Exec(execSQL); err != nil {
			tx.Rollback()
			log.Fatalf("execute migration %s failed: %v", file, err)
		}

		if _, err := tx.Exec("INSERT INTO schema_migrations (version) VALUES ($1)", file); err != nil {
			tx.Rollback()
			log.Fatalf("record migration %s failed: %v", file, err)
		}

		if err := tx.Commit(); err != nil {
			log.Fatalf("commit tx failed: %v", err)
		}
		fmt.Printf("Successfully applied migration %s\n", file)
	}
	fmt.Println("All migrations applied successfully!")
}
