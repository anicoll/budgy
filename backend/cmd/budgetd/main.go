package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"os"
	"time"

	"budgeting_system/internal/api"
	"budgeting_system/internal/basiq"
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

	var basiqService *basiq.Service
	basiqAPIKey := os.Getenv("BASIQ_API_KEY")
	if basiqAPIKey != "" {
		log.Println("Basiq API key configured. Initializing Basiq service...")
		basiqService = basiq.NewService(basiqAPIKey)
	} else {
		log.Println("Warning: BASIQ_API_KEY is not configured. Basiq service will be disabled.")
	}

	apiServer := api.NewAPIServer(budgets, accounts, categories, transactions, users, basiqService)

	appWebhookURL := os.Getenv("APP_WEBHOOK_URL")
	if basiqService != nil && appWebhookURL != "" {
		go func() {
			log.Printf("Automatically registering Basiq webhook for URL: %s", appWebhookURL)
			// Wait a brief moment for the server to spin up
			time.Sleep(2 * time.Second)
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			if err := basiqService.RegisterWebhook(ctx, appWebhookURL); err != nil {
				log.Printf("Basiq Webhook registration failed: %v", err)
			} else {
				log.Println("Basiq Webhook registration completed successfully.")
			}
		}()
	}

	allowedOrigin := os.Getenv("ALLOWED_ORIGINS")
	var handler http.Handler = apiServer.Routes()
	handler = withCORS(handler, allowedOrigin)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Listening on :%s", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func withCORS(next http.Handler, allowedOrigin string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := allowedOrigin
		if origin == "" {
			origin = r.Header.Get("Origin")
		}
		if origin == "" {
			origin = "*"
		}

		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		
		next.ServeHTTP(w, r)
	})
}
