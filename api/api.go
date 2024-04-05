package api

import (
	"changemedaddy/invest"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/render"
)

type DB interface {
	PositionProvider
	PositionAdder
	PositionPutter
}

type API struct {
	db DB
}

func New(db DB) *API {
	return &API{db: db}
}

func (api API) NewRouter() chi.Router {
	r := chi.NewRouter()

	r.Use(render.SetContentType(render.ContentTypeJSON))
	r.Use(middleware.Logger)

	r.Route("/api", api.router)

	return r
}

func (api API) router(r chi.Router) {
	r.Get("/position/{id}", api.handleGetPosition)
	r.Post("/position", api.handlePostPosition)
	r.Patch("/position/{id}/target", handleChange[invest.TargetPriceChange](api))
	r.Patch("/position/{id}/amount", handleChange[invest.AmountChange](api))
	r.Patch("/position/{id}/deadline", handleChange[invest.DeadlineChange](api))
}
