FROM golang:1.24-alpine AS builder

ENV GOTOOLCHAIN=auto

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/server-windows .

FROM alpine:3.21

RUN apk add --no-cache ca-certificates

WORKDIR /app

COPY --from=builder /out/server-windows /app/server-windows

ENV LISTEN_ADDR=:8082
ENV GIN_MODE=release

EXPOSE 8082

ENTRYPOINT ["/app/server-windows"]
