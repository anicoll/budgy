package main

import (
	"bytes"
	"database/sql"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"budgeting_system/internal/storage"

	_ "github.com/lib/pq"
)

const (
	containerName = "budgy-postgres-dump"
	dbPort        = "54321"
	dbName        = "budgy"
	dbUser        = "postgres"
	dbPassword    = "postgres"
)

func main() {
	// 1. Ensure directory exists
	schemaDir := filepath.Join("internal", "storage", "schema")
	if err := os.MkdirAll(schemaDir, 0755); err != nil {
		log.Fatalf("Failed to create schema directory: %v", err)
	}

	// 2. Setup cleanup first
	cleanup := func() {
		log.Println("Cleaning up: stopping and removing temporary Postgres container...")
		exec.Command("docker", "stop", containerName).Run()
		exec.Command("docker", "rm", containerName).Run()
	}
	defer cleanup()

	// Proactively clean up any previous crashed container
	exec.Command("docker", "stop", containerName).Run()
	exec.Command("docker", "rm", containerName).Run()

	// 3. Start Postgres container
	log.Println("Starting Postgres container...")
	runCmd := exec.Command("docker", "run",
		"--name", containerName,
		"-e", "POSTGRES_DB="+dbName,
		"-e", "POSTGRES_USER="+dbUser,
		"-e", "POSTGRES_PASSWORD="+dbPassword,
		"-p", dbPort+":5432",
		"-d", "postgres:15-alpine",
	)
	if err := runCmd.Run(); err != nil {
		log.Fatalf("Failed to start Postgres container: %v", err)
	}

	// 4. Wait for Postgres to be ready
	log.Println("Waiting for Postgres to be ready...")
	ready := false
	for range 30 {
		cmd := exec.Command("docker", "exec", containerName, "pg_isready", "-U", dbUser)
		if err := cmd.Run(); err == nil {
			ready = true
			break
		}
		time.Sleep(1 * time.Second)
	}
	if !ready {
		log.Fatalf("Postgres container failed to become ready in time")
	}
	// Small extra delay to make sure TCP connections are accepted
	time.Sleep(1 * time.Second)

	// 5. Connect and migrate
	connStr := fmt.Sprintf("postgres://%s:%s@localhost:%s/%s?sslmode=disable", dbUser, dbPassword, dbPort, dbName)
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Ping check
	pinged := false
	for range 10 {
		if err := db.Ping(); err == nil {
			pinged = true
			break
		}
		time.Sleep(500 * time.Millisecond)
	}
	if !pinged {
		log.Fatalf("Failed to ping Postgres database")
	}

	log.Println("Running database migrations...")
	if err := storage.MigrateWithDialect(db, "postgres"); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// 6. Dump full schema
	log.Println("Dumping full schema...")
	schemaPath := filepath.Join(schemaDir, "schema.sql")
	dumpCmd := exec.Command("docker", "exec", containerName,
		"pg_dump", "-U", dbUser, "-d", dbName,
		"--schema-only", "--no-owner", "--no-acl",
	)
	var outBuf bytes.Buffer
	dumpCmd.Stdout = &outBuf
	var errBuf bytes.Buffer
	dumpCmd.Stderr = &errBuf
	if err := dumpCmd.Run(); err != nil {
		log.Fatalf("Failed to pg_dump schema: %v, stderr: %s", err, errBuf.String())
	}
	if err := os.WriteFile(schemaPath, cleanSQLOutput(outBuf.Bytes()), 0644); err != nil {
		log.Fatalf("Failed to write schema.sql: %v", err)
	}
	log.Printf("Successfully generated %s\n", schemaPath)

	// 7. Get user tables
	rows, err := db.Query(`
		SELECT table_name 
		FROM information_schema.tables 
		WHERE table_schema = 'public' 
		  AND table_type = 'BASE TABLE' 
		  AND table_name NOT LIKE 'goose_db_version'
		ORDER BY table_name;
	`)
	if err != nil {
		log.Fatalf("Failed to query table names: %v", err)
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var table string
		if err := rows.Scan(&table); err != nil {
			log.Fatalf("Failed to scan table name: %v", err)
		}
		tables = append(tables, table)
	}

	// 8. Dump each table individually
	log.Println("Dumping tables individually...")
	for _, table := range tables {
		tablePath := filepath.Join(schemaDir, fmt.Sprintf("%s.sql", table))
		tableDumpCmd := exec.Command("docker", "exec", containerName,
			"pg_dump", "-U", dbUser, "-d", dbName,
			"--schema-only", "--no-owner", "--no-acl",
			"-t", table,
		)
		var tOutBuf bytes.Buffer
		tableDumpCmd.Stdout = &tOutBuf
		var tErrBuf bytes.Buffer
		tableDumpCmd.Stderr = &tErrBuf
		if err := tableDumpCmd.Run(); err != nil {
			log.Fatalf("Failed to pg_dump table %s: %v, stderr: %s", table, err, tErrBuf.String())
		}
		if err := os.WriteFile(tablePath, cleanSQLOutput(tOutBuf.Bytes()), 0644); err != nil {
			log.Fatalf("Failed to write table SQL for %s: %v", table, err)
		}
		log.Printf("Successfully generated %s\n", tablePath)
	}

	log.Println("Database schema generation complete!")
}

// cleanSQLOutput filters out sandbox control lines starting with backslashes
func cleanSQLOutput(input []byte) []byte {
	lines := strings.Split(string(input), "\n")
	var cleaned []string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "\\") {
			continue
		}
		cleaned = append(cleaned, line)
	}
	return []byte(strings.Join(cleaned, "\n"))
}
