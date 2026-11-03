.PHONY: help install dev dev-api dev-online \
	build build-frontend build-backend \
	start typecheck \
	lint lint-frontend lint-backend lint-fix \
	test test-frontend test-backend test-watch check \
	clean reset shadcn-add \
	backend-build backend-up backend-down backend-logs \
	db-dump db-generate mocks-generate mappings-generate proto-generate gen-all \
	bootstrap-bazel .bin/bazel

PNPM ?= pnpm

BAZEL_BIN := $(firstword $(wildcard ./.bin/bazel) $(shell command -v bazelisk 2>/dev/null) $(shell command -v bazel 2>/dev/null))
BAZEL ?= $(if $(BAZEL_BIN),$(BAZEL_BIN),./.bin/bazel)

help: ## List available targets
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_.-]+:.*?## / {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ── Setup ─────────────────────────────────────────────────────────────────────

install: ## Install frontend and backend dependencies
	$(PNPM) install
	go -C backend mod download

clean: ## Remove build artefacts
	rm -rf .next .turbo coverage

reset: clean ## Remove node_modules and reinstall
	rm -rf node_modules
	$(PNPM) install

bootstrap-bazel: .bin/bazel ## Download Bazelisk to .bin/bazel (linux amd64)

.bin/bazel:
	@mkdir -p .bin
	curl -fsSL -o $@ "https://github.com/bazelbuild/bazelisk/releases/download/v1.25.0/bazelisk-linux-amd64"
	chmod +x $@

# ── Local development ─────────────────────────────────────────────────────────

dev: ## Start Next.js dev server (offline mode) on :3000
	$(PNPM) dev

dev-api: ## Start Next.js dev server with backend API enabled
	$(PNPM) dev:api

dev-online: backend-up ## Build backend, start container, then frontend with API
	$(PNPM) dev:api

backend-build: $(if $(BAZEL_BIN),,$(BAZEL)) ## Build backend Docker image via Bazel
	$(BAZEL) run //backend/cmd/budgetd:tarball

backend-up: backend-build ## Build backend image and start container
	docker compose up -d

backend-down: ## Stop the backend container
	docker compose down

backend-logs: ## Follow backend container logs
	docker compose logs -f

# ── Quality checks ────────────────────────────────────────────────────────────

typecheck: ## Run TypeScript without emitting
	$(PNPM) typecheck

lint: ## Run frontend and backend linters in parallel
	@$(MAKE) -j2 lint-frontend lint-backend

lint-frontend: ## Run Biome check on frontend
	$(PNPM) lint

lint-backend: ## Run Go vet on backend
	go -C backend vet ./...

lint-fix: ## Apply safe Biome fixes and Go fmt
	$(PNPM) lint:fix
	go -C backend fmt ./...

test: ## Run frontend and backend tests in parallel
	@$(MAKE) -j2 test-frontend test-backend

test-frontend: ## Run Vitest suite
	$(PNPM) test

test-backend: $(if $(BAZEL_BIN),,$(BAZEL)) ## Run Bazel tests for backend
	$(BAZEL) test //...

test-watch: ## Run Vitest in watch mode
	$(PNPM) test:watch

build: ## Build frontend and backend in parallel
	@$(MAKE) -j2 build-frontend build-backend

build-frontend: ## Production build for Next.js
	$(PNPM) build

build-backend: $(if $(BAZEL_BIN),,$(BAZEL)) ## Bazel build for Go backend
	$(BAZEL) build //...

start: build ## Build then serve the production frontend bundle
	$(PNPM) start

check: typecheck ## Full local CI: typecheck, then lint + test + build in parallel
	@$(MAKE) -j3 lint test build
	@echo "check passed"

# ── UI scaffolding ────────────────────────────────────────────────────────────

shadcn-add: ## Add a shadcn component, e.g. `make shadcn-add COMP=dialog`
	@if [ -z "$(COMP)" ]; then echo "Usage: make shadcn-add COMP=<component>"; exit 2; fi
	$(PNPM) dlx shadcn@latest add $(COMP) --yes

# ── Code generation ───────────────────────────────────────────────────────────

proto-generate: ## Generate protobuf stubs for frontend and backend
	$(PNPM) exec buf generate

db-dump: ## Dump SQLite schema for sqlc
	go -C backend run ./cmd/schema-dump

db-generate: db-dump ## Regenerate sqlc models from schema
	go -C backend run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.27.0 generate

mocks-generate: ## Regenerate Go test mocks
	go -C backend generate ./...

mappings-generate: ## Regenerate sesame mappers
	go -C backend run github.com/yuin/sesame/cmd/sesame -c sesame.yml

gen-all: ## Regenerate proto, db, mocks, and mappings
	$(MAKE) proto-generate db-generate mocks-generate mappings-generate
	go -C backend fix ./...
