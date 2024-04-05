package main

import (
	"changemedaddy/api"
	"changemedaddy/db/inmem"
	"log/slog"
	"net/http"
)

func main() {
	db := inmem.New()
	log := slog.Default()
	api := api.New(db, log)

	log.Info("serving http")
	http.ListenAndServe(":80", api.NewRouter())
}
