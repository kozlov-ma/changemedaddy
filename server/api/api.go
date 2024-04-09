package api

import (
	"changemedaddy/invest"
	"changemedaddy/server/core"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/render"
	slogchi "github.com/samber/slog-chi"
	"log/slog"
	"net/http"
	"time"
)

type API struct {
	db     core.DB
	market core.MarketProvider
	log    *slog.Logger

	router chi.Router
}

func (api *API) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	api.router.ServeHTTP(w, r)
}

func (api *API) Pattern() string {
	return "/api"
}

func New(db core.DB, market core.MarketProvider, log *slog.Logger) *API {
	log = log.With("router", "api")
	r := chi.NewRouter()

	logConfig := slogchi.Config{
		WithRequestID: true,
	}

	api := &API{db: db, market: market, log: log}

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(slogchi.NewWithConfig(api.log, logConfig))
	r.Use(middleware.Timeout(4 * time.Second))
	r.Use(middleware.Heartbeat("ping"))

	r.Route("/position", func(r chi.Router) {
		r.Use(render.SetContentType(render.ContentTypeJSON))
		r.Get("/{id}", api.handleGetPosition)
		r.Post("/", api.handlePostPosition)
		r.Patch("/{id}/target", handleChange[invest.TargetPriceChange](api))
		r.Patch("/{id}/amount", handleChange[invest.AmountChange](api))
		r.Patch("/{id}/deadline", handleChange[invest.DeadlineChange](api))
	})

	api.router = r

	return api
}
