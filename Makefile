.PHONY: start stop status logs

CONTAINER_NAME = solana-tools-backend
IMAGE_NAME = solana-tools-backend
PORT = 8080

start:
	@if [ ! -f .env ]; then \
		echo "Error: .env file not found"; \
		exit 1; \
	fi
	docker build -t $(IMAGE_NAME) -f Dockerfile .
	docker rm -f $(CONTAINER_NAME) || true
	docker run -d \
		--name $(CONTAINER_NAME) \
		--env-file .env \
		-p $(PORT):8000 \
		$(IMAGE_NAME)
	docker logs -f $(CONTAINER_NAME)

stop:
	docker stop $(CONTAINER_NAME)
	docker rm $(CONTAINER_NAME)

status:
	docker ps -a --filter "name=$(CONTAINER_NAME)" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

logs:
	docker logs -f $(CONTAINER_NAME)

