package api

import (
	"changemedaddy/invest"
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

type DB interface {
	PositionProvider
	PositionAdder
	PositionPutter
}

type API struct {
	db     DB
	market MarketProvider
	log    *slog.Logger
}

func New(db DB, market MarketProvider, log *slog.Logger) *API {
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

	r.Route("/api", func(r chi.Router) {
		r.Use(render.SetContentType(render.ContentTypeJSON))
		r.Get("/position/{id}", api.handleGetPosition)
		r.Post("/position", api.handlePostPosition)
		r.Patch("/position/{id}/target", handleChange[invest.TargetPriceChange](api))
		r.Patch("/position/{id}/amount", handleChange[invest.AmountChange](api))
		r.Patch("/position/{id}/deadline", handleChange[invest.DeadlineChange](api))
	})

	r.Route("/position", func(r chi.Router) {
		r.Use(render.SetContentType(render.ContentTypeHTML))
		r.Get("/{id}", api.handleGetPosition)
	})

	return r
}
