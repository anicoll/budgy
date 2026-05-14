.PHONY: help install dev build start typecheck lint lint-fix format test test-watch check clean reset shadcn-add

PNPM ?= pnpm

help: ## List available targets
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies
	$(PNPM) install

dev: ## Start the Next.js dev server (Turbopack) on :3000
	$(PNPM) dev

build: ## Production build
	$(PNPM) build

start: build ## Build then serve the production bundle
	$(PNPM) start

typecheck: ## Run TypeScript without emitting
	$(PNPM) typecheck

lint: ## Run Biome lint + format checks
	$(PNPM) lint

lint-fix: ## Apply safe Biome fixes (imports, format, lint)
	$(PNPM) lint:fix

format: ## Format source with Biome
	$(PNPM) format

test: ## Run Vitest once
	$(PNPM) test

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
