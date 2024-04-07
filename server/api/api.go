package api

import (
	"changemedaddy/invest"
	"changemedaddy/server/core"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/render"
	"github.com/go-playground/validator/v10"
	slogchi "github.com/samber/slog-chi"
	"log/slog"
	"time"
)

var (
	validate = validator.New(validator.WithRequiredStructEnabled())
)

type API struct {
	db     core.DB
	market core.MarketProvider
	log    *slog.Logger
}

func New(db core.DB, market core.MarketProvider, log *slog.Logger) *API {
	log = log.With("package", "api")
	return &API{db: db, market: market, log: log}
}

func (api API) NewRouter() chi.Router {
	r := chi.NewRouter()

	logConfig := slogchi.Config{
		WithRequestID: true,
	}

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

	return r
}
