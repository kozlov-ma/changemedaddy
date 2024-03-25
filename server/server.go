package main

import (
	"changemedaddy/db/mock"
	"changemedaddy/invest"
	"fmt"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"net/http"
	"strconv"
)

// create
type IdeaSaver interface {
	SaveIdea(invest.Idea) (invest.Idea, error)
}

// update
type IdeaUpdater interface {
	UpdateIdea(idea invest.Idea) error
}

// get
type IdeaProvider interface {
	GetIdea(int64) (invest.Idea, error)
}

// update position
type PositionUpdater interface {
	UpdatePosition(invest.Position) error
}

// get position
type PositionProvider interface {
	GetPosition(int64) (invest.Position, error)
}

var database = mock.NewRDB()

func main() {
	r := chi.NewRouter()

	r.Use(middleware.Logger)

	r.Route("/api", ApiRouter)

	http.ListenAndServe(":3333", r)
}

func ApiRouter(r chi.Router) {
	r.Route("/idea", IdeaRouter)
	r.Route("/position", PositionRouter)
}

func IdeaRouter(r chi.Router) {
	r.Get("/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)

		idea, _ := database.GetIdea(id)

		fmt.Fprintln(w, idea)
	})
}

func PositionRouter(r chi.Router) {
	r.Get("/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)

		position, _ := database.GetPosition(id)

		fmt.Fprintln(w, position)
	})
}
