# Build stage
FROM golang:1.26.4-alpine AS builder

WORKDIR /app

# Copy go.mod and go.sum and download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy all source files
COPY . .

# Build the Go binary for the main entry point
RUN CGO_ENABLED=0 GOOS=linux go build -o budgetd ./cmd/budgetd/main.go

# Production stage
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy the binary from the builder
COPY --from=builder /app/budgetd /app/budgetd

EXPOSE 8080

CMD ["/app/budgetd"]
