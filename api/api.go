package api

import (
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/render"
	"net/http"
)

type API struct {
	IdeaProvider
	IdeaSaver
	IdeaUpdater
	PositionUpdater
	PositionProvider
}

func (api API) RunServer() {
	r := chi.NewRouter()

	r.Use(render.SetContentType(render.ContentTypeJSON))
	r.Use(middleware.Logger)

	r.Route("/api", api.Router)

	http.ListenAndServe(":80", r)
}

func (api API) Router(r chi.Router) {
	r.Get("/idea/{id}", api.handleGetIdea)
	r.Post("/idea", api.handlePostIdea)
	r.Patch("/idea/{id}/deadline", api.handleDeadlineChange)

	r.Get("/idea/{id}/position/{idx}", api.handleGetPosition)
	r.Patch("/idea/{id}/position/{idx}/target", api.handleTargetPriceChange)
	r.Patch("/idea/{id}/position/{idx}/amount", api.handleAmountChange)
}
