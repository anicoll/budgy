package main

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"time"

	"budgeting_system/internal/api"
	"budgeting_system/internal/basiq"
	"budgeting_system/internal/service"
	"budgeting_system/internal/storage"

	_ "github.com/ncruces/go-sqlite3/driver"
	_ "github.com/ncruces/go-sqlite3/embed"
	"go.uber.org/zap"
)

func initLogger() {
	var config zap.Config
	if os.Getenv("DEBUG") == "true" || os.Getenv("LOG_LEVEL") == "debug" {
		config = zap.NewDevelopmentConfig()
		config.Level = zap.NewAtomicLevelAt(zap.DebugLevel)
	} else {
		config = zap.NewProductionConfig()
		config.Level = zap.NewAtomicLevelAt(zap.InfoLevel)
	}
	
	logger, err := config.Build()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to initialize zap logger: %v\n", err)
		os.Exit(1)
	}
	zap.ReplaceGlobals(logger)
}

func main() {
	initLogger()
	defer zap.L().Sync()

	zap.S().Info("Starting budgeting API server...")

	dbPath := os.Getenv("DATABASE_URL")
	if dbPath == "" {
		dbPath = "file:budget.db"
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		zap.S().Fatalf("Failed to open database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		zap.S().Fatalf("Failed to ping database: %v", err)
	}

	// Run migrations
	if err := storage.Migrate(db); err != nil {
		zap.S().Fatalf("Failed to run migrations: %v", err)
	}

	// Create storage and repositories
	store := storage.NewSQLiteStorage(db)
	budgetsRepo := store.Budgets()
	accountsRepo := store.Accounts()
	categoriesRepo := store.Categories()
	transactionsRepo := store.Transactions()
	usersRepo := store.Users()
	allocationsRepo := store.Allocations()

	var basiqService *basiq.Service
	basiqAPIKey := os.Getenv("BASIQ_API_KEY")
	if basiqAPIKey != "" {
		zap.S().Info("Basiq API key configured. Initializing Basiq service...")
		basiqService = basiq.NewService(basiqAPIKey)
	} else {
		zap.S().Warn("Warning: BASIQ_API_KEY is not configured. Basiq service will be disabled.")
	}

	authSvc := service.NewAuthService(usersRepo)
	budgetSvc := service.NewBudgetService(budgetsRepo, accountsRepo, categoriesRepo)
	accountSvc := service.NewAccountService(accountsRepo, budgetsRepo, allocationsRepo, transactionsRepo)
	categorySvc := service.NewCategoryService(categoriesRepo, accountsRepo, allocationsRepo, transactionsRepo)
	txSvc := service.NewTransactionService(transactionsRepo, accountsRepo, categoriesRepo, budgetsRepo)


	var bankSyncSvc service.BankSyncService
	if basiqService != nil {
		bankSyncSvc = service.NewBankSyncService(usersRepo, budgetsRepo, accountsRepo, transactionsRepo, basiqService)
	}

	apiServer := api.NewAPIServer(authSvc, budgetSvc, accountSvc, categorySvc, txSvc, bankSyncSvc)

	appWebhookURL := os.Getenv("APP_WEBHOOK_URL")
	if basiqService != nil && appWebhookURL != "" {
		go func() {
			zap.S().Infof("Automatically registering Basiq webhook for URL: %s", appWebhookURL)
			// Wait a brief moment for the server to spin up
			time.Sleep(2 * time.Second)
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			if err := basiqService.RegisterWebhook(ctx, appWebhookURL); err != nil {
				zap.S().Errorf("Basiq Webhook registration failed: %v", err)
			} else {
				zap.S().Info("Basiq Webhook registration completed successfully.")
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

	zap.S().Infof("Listening on :%s", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		zap.S().Fatalf("Server failed: %v", err)
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
