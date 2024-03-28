package api

import (
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/render"
	"net/http"
)

type Server struct {
	IdeaProvider     IdeaProvider
	IdeaSaver        IdeaSaver
	IdeaUpdater      IdeaUpdater
	PositionUpdater  PositionUpdater
	PositionProvider PositionProvider
}

var server = Server{
	IdeaProvider:     nil,
	IdeaSaver:        nil,
	IdeaUpdater:      nil,
	PositionUpdater:  nil,
	PositionProvider: nil,
}

func RunServer() {
	r := chi.NewRouter()

	r.Use(render.SetContentType(render.ContentTypeJSON))
	r.Use(middleware.Logger)

	r.Route("/api", apiRouter)

	http.ListenAndServe(":80", r)
}

func apiRouter(r chi.Router) {
	r.Route("/", routeIdeas)
	r.Route("/", routePositions)
}
