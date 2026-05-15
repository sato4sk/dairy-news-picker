.PHONY: deploy-functions setup-env setup-scheduler

deploy-functions:
	./scripts/deploy-functions.sh

setup-scheduler:
	./scripts/setup-scheduler.sh

setup-env:
	cp .env.deploy.example .env.deploy
	@echo "Created .env.deploy from template. Please fill in the values."
