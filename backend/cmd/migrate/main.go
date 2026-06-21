package main

import (
	"database/sql"
	"fmt"
	"os"

	"budgeting_system/internal/storage"

	_ "github.com/ncruces/go-sqlite3/driver"
	_ "github.com/ncruces/go-sqlite3/embed"
)

func main() {
	dbPath := os.Getenv("DATABASE_URL")
	if dbPath == "" {
		if len(os.Args) > 1 {
			dbPath = os.Args[1]
		} else {
			dbPath = "file:budget.db"
		}
	}
	if dbPath != "" && dbPath[:5] != "file:" {
		dbPath = "file:" + dbPath
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "open db: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := storage.Migrate(db); err != nil {
		fmt.Fprintf(os.Stderr, "migrate: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("migrations applied:", dbPath)
}
