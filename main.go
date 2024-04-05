package main

import (
	"changemedaddy/api"
	"changemedaddy/db/inmem"
	"changemedaddy/market/fake"
	"log/slog"
	"net/http"
)

func main() {
	db := inmem.New()
	log := slog.Default()
	market := fake.NewMarket()
	api := api.New(db, market, log)

	log.Info("serving http")
	http.ListenAndServe(":80", api.NewRouter())
}
