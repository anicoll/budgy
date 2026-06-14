.PHONY: help install dev build start typecheck lint lint-fix format test test-watch check clean reset shadcn-add db-dump db-generate mocks-generate mappings-generate gen-all

PNPM ?= pnpm

help: ## List available targets
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies
	$(PNPM) install
	go -C backend mod download

dev: ## Start the Next.js dev server (Turbopack) on :3000
	$(PNPM) dev

dev-api: ## Start Next.js dev server with backend API integration enabled
	$(PNPM) dev:api

build: ## Production build
	$(PNPM) build
	go -C backend build ./...

start: build ## Build then serve the production bundle
	$(PNPM) start

typecheck: ## Run TypeScript without emitting
	$(PNPM) typecheck

lint: ## Run Biome check + Go vet
	$(PNPM) lint
	go -C backend vet ./...

lint-fix: ## Apply safe Biome fixes + Go fmt
	$(PNPM) lint:fix
	go -C backend fmt ./...

format: ## Format source with Biome + Go fmt
	$(PNPM) format
	go -C backend fmt ./...

test: ## Run Vitest and Go tests
	$(PNPM) test
	go -C backend test ./...

test-watch: ## Run Vitest in watch mode
	$(PNPM) test:watch

check: typecheck lint test ## Full local CI: typecheck + lint + tests
	@echo "✓ check passed"

shadcn-add: ## Add a shadcn component, e.g. `make shadcn-add COMP=dialog`
	@if [ -z "$(COMP)" ]; then echo "Usage: make shadcn-add COMP=<component>"; exit 2; fi
	$(PNPM) dlx shadcn@latest add $(COMP) --yes

clean: ## Remove build artefacts
	rm -rf .next .turbo coverage

reset: clean ## Nuke node_modules + lockfile cache then reinstall
	rm -rf node_modules
	$(PNPM) install

backend-build: ## Build the Go backend Docker container via Bazel rules_oci
	$(PNPM) backend:build

backend-up: ## Start the Go backend container via Docker Compose
	$(PNPM) backend:up

backend-down: ## Stop the Go backend container via Docker Compose
	$(PNPM) backend:down

backend-logs: ## Follow logs for the Go backend container via Docker Compose
	$(PNPM) backend:logs

db-dump: ## Run the containerized Postgres schema-dump script
	go -C backend run ./cmd/schema-dump

db-generate: db-dump ## Run schema-dump then generate sqlc models
	go -C backend run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.27.0 generate

mocks-generate: ## Generate mock files for repositories and services
	go -C backend generate ./...

mappings-generate: ## Generate sesame mappers
	go -C backend run github.com/yuin/sesame/cmd/sesame -c sesame.yml

gen-all: ## Generate all: db-schema, mocks, and mappings
	make db-generate \
	mocks-generate \
	mappings-generate 

