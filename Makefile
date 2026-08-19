# Release automation for calendar-week-view.
#
#   make verify   # test + typecheck + lint + build
#   make push     # ship the current feature branch:
#                 #   verify -> push branch -> open PR -> merge to main ->
#                 #   tag vX.Y.Z (from package.json) -> push tag
#                 # Pushing the tag triggers .github/workflows/release.yml.
#
# Bump "version" in package.json before `make push`; the tag follows it.

SHELL := /bin/bash
VERSION := $(shell node -p "require('./package.json').version")
BRANCH := $(shell git rev-parse --abbrev-ref HEAD)
TAG := v$(VERSION)

.PHONY: verify push

verify:
	pnpm test
	pnpm typecheck
	pnpm lint
	pnpm build

push:
	@if [ "$(BRANCH)" = "main" ]; then \
		echo "On main — switch to a feature branch before releasing."; exit 1; fi
	@if ! git diff --quiet || ! git diff --cached --quiet; then \
		echo "Uncommitted changes — commit them first."; exit 1; fi
	@if git rev-parse -q --verify "refs/tags/$(TAG)" >/dev/null; then \
		echo "Tag $(TAG) already exists — bump \"version\" in package.json."; exit 1; fi
	$(MAKE) verify
	git push -u origin "$(BRANCH)"
	gh pr create --fill --base main
	gh pr merge --merge
	git push origin --delete "$(BRANCH)"
	git fetch origin main
	git tag "$(TAG)" FETCH_HEAD
	git push origin "$(TAG)"
	@echo "Released $(TAG) — release.yml will build and publish it. Still on $(BRANCH)."
