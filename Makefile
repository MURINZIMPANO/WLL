# LyricLens — native dev orchestration. No Docker, no containers.
# Windows users: `make` requires Git Bash / WSL. Pure-npm equivalents are in
# package.json, and `pnpm dev` runs everything through turbo on any platform.

.DEFAULT_GOAL := help
SHELL := /bin/sh

.PHONY: help install dev build verify lint typecheck test format storybook \
        db-generate db-migrate db-studio speech-bootstrap speech-bootstrap-ml \
        desktop-dev doctor clean

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

install: ## Install all JS workspace dependencies
	pnpm install

dev: ## Run api + web + speech + render together
	pnpm dev

build: ## Build every package
	pnpm build

verify: ## The full CI gate locally: format, lint, typecheck, unit tests
	pnpm verify

lint: ## Lint
	pnpm lint

typecheck: ## Typecheck every package
	pnpm typecheck

test: ## Run unit + integration tests
	pnpm test

format: ## Format the repo
	pnpm format

storybook: ## Open the design-system Storybook
	pnpm storybook

db-generate: ## Regenerate Drizzle types from the schema
	pnpm db:generate

db-migrate: ## Apply database migrations to the local SQLite file
	pnpm db:migrate

db-studio: ## Open Drizzle Studio
	pnpm db:studio

speech-bootstrap: ## Create the Python venv and install the lightweight deps
	pnpm speech:bootstrap

speech-bootstrap-ml: ## Additionally install faster-whisper (large download)
	pnpm speech:bootstrap:ml

desktop-dev: ## Run the Tauri desktop shell (requires Rust: see README)
	pnpm --filter @lyriclens/desktop dev

doctor: ## Check native prerequisites (node, pnpm, python, ffmpeg, rust)
	pnpm doctor

clean: ## Remove build output and caches
	pnpm clean
