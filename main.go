package main

import (
	"changemedaddy/db/inmem"
	"changemedaddy/market/fake"
	"changemedaddy/server"
	"github.com/charmbracelet/log"
	"log/slog"
	"os"
)

func main() {
	db := inmem.New()

	handler := log.New(os.Stderr)
	log := slog.New(handler)

	market := fake.NewMarket()

	server.Run(market, db, log)
}
