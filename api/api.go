package api

import (
	"changemedaddy/invest"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/render"
	"github.com/go-playground/validator/v10"
)

type DB interface {
	PositionProvider
	PositionAdder
	PositionPutter
}

type API struct {
	db       DB
	validate validator.Validate
}

func New(db DB, validate validator.Validate) *API {
	return &API{db: db, validate: validate}
}

func (api API) NewRouter() chi.Router {
	r := chi.NewRouter()

	r.Use(render.SetContentType(render.ContentTypeJSON))
	r.Use(middleware.Logger)

	r.Route("/api", api.Router)

	return r
}

func (api API) Router(r chi.Router) {
	r.Get("/position/{id}", api.handleGetPosition)
	r.Post("/position", api.handlePostPosition)
	r.Patch("/position/{id}/target", handleChange[invest.TargetPriceChange](api))
	r.Patch("/position/{id}/amount", handleChange[invest.AmountChange](api))
	r.Patch("/position/{id}/deadline", handleChange[invest.DeadlineChange](api))
}
