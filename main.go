package main

import (
	"changemedaddy/api"
	"changemedaddy/db/inmem"
	"changemedaddy/market/fake"
	"github.com/charmbracelet/log"
	"log/slog"
	"net/http"
	"os"
)

func main() {
	db := inmem.New()

	handler := log.New(os.Stderr)
	log := slog.New(handler)

	market := fake.NewMarket()
	api := api.New(db, market, log)

	log.Info("serving http")
	http.ListenAndServe(":80", api.NewRouter())
}
