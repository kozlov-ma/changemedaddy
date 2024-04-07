package server

import (
	"changemedaddy/server/api"
	"changemedaddy/server/core"
	"changemedaddy/server/web"
	"github.com/go-chi/chi/v5"
	"log/slog"
	"net/http"
)

func Run(market core.MarketProvider, db core.DB, log *slog.Logger) {
	log.Info("serving http")

	var (
		api = api.New(db, market, log)
		web = web.New(db, market, log)
	)

	r := chi.NewRouter()
	r.Mount("/api", api.NewRouter())
	r.Mount("/web", web.NewRouter())

	http.ListenAndServe(":80", r)
}
