package main

import (
	"changemedaddy/db"
	"changemedaddy/db/inmem"
	"changemedaddy/db/mock"
	"changemedaddy/invest"
	"errors"
	"fmt"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/render"
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

var (
	database = inmem.New()

	ideaSaver        IdeaSaver        = database
	ideaUpdater      IdeaUpdater      = database
	ideaProvider     IdeaProvider     = mock.NewRandIdeaGen()
	positionUpdater  PositionUpdater  = database
	positionProvider PositionProvider = mock.NewRandPosGen()
)

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
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			w.WriteHeader(400)
			fmt.Fprintln(w, "bad id")
			return
		}

		idea, err := ideaProvider.GetIdea(id)
		if errors.Is(err, db.IdeaDoesNotExistError) {
			w.WriteHeader(404)
			return
		}

		fmt.Fprintln(w, idea)
	})

	r.Post("/", func(w http.ResponseWriter, r *http.Request) {
		idea := invest.Idea{}

		err := render.Decode(r, &idea)
		if err != nil {
			w.WriteHeader(400)
			return
		}

		idea, err = ideaSaver.SaveIdea(idea)
		if err != nil {
			w.WriteHeader(400)
			return
		}

		fmt.Fprintf(w, "done with id %v", idea.ID)
	})

	r.Patch("/{id}", func(w http.ResponseWriter, r *http.Request) {
		idea := invest.Idea{}

		err := render.Decode(r, &idea)
		if err != nil {
			w.WriteHeader(400)
			return
		}

		err = ideaUpdater.UpdateIdea(idea)
		if errors.Is(err, db.IdeaDoesNotExistError) {
			w.WriteHeader(404)
			return
		}

		if errors.Is(err, db.PositionDoesNotExistError) {
			w.WriteHeader(400)
			return
		}

		fmt.Fprintf(w, "idea updated")
	})
}

func PositionRouter(r chi.Router) {
	r.Get("/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			w.WriteHeader(400)
			fmt.Fprintf(w, "bad id")
			return
		}

		position, err := positionProvider.GetPosition(id)
		if errors.Is(err, db.PositionDoesNotExistError) {
			w.WriteHeader(404)
			return
		}

		fmt.Fprintln(w, position)
	})

	r.Patch("/{id}", func(w http.ResponseWriter, r *http.Request) {
		position := invest.Position{}
		err := render.Decode(r, &position)
		if err != nil {
			w.WriteHeader(400)
			return
		}

		err = positionUpdater.UpdatePosition(position)
		if errors.Is(err, db.PositionDoesNotExistError) {
			w.WriteHeader(404)
			return
		}

		fmt.Fprintf(w, "position updated")
	})
}
