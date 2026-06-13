package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"

	"budgeting_system/internal/api"
	"budgeting_system/internal/storage"

	_ "github.com/ncruces/go-sqlite3/driver"
	_ "github.com/ncruces/go-sqlite3/embed"
)

func main() {
	log.Println("Starting budgeting API server...")

	dbPath := os.Getenv("DATABASE_URL")
	if dbPath == "" {
		dbPath = "file:budget.db"
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	// Run migrations
	if err := storage.Migrate(db); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

		// Create storage and repositories
	store := storage.NewSQLiteStorage(db)
	budgets := store.Budgets()
	accounts := store.Accounts()
	categories := store.Categories()
	transactions := store.Transactions()
	users := store.Users()

	apiServer := api.NewAPIServer(budgets, accounts, categories, transactions, users)

	allowedOrigin := os.Getenv("ALLOWED_ORIGINS")
	var handler http.Handler = apiServer.Routes()
	if allowedOrigin != "" {
		handler = withCORS(handler, allowedOrigin)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Listening on :%s", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func withCORS(next http.Handler, origin string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		
		next.ServeHTTP(w, r)
	})
}
