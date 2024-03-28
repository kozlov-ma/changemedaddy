package api

import (
	"changemedaddy/db"
	"changemedaddy/db/inmem"
	"changemedaddy/db/mock"
	"changemedaddy/invest"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/render"
	"net/http"
	"strconv"
)

// create new
type IdeaSaver interface {
	AddIdea(idea invest.Idea) (id int64, err error)
}

// change existing
type IdeaUpdater interface {
	UpdateIdea(id int64, idea invest.Idea) error
}

// get
type IdeaProvider interface {
	GetIdea(id int64) (invest.Idea, error)
}

// update position
type PositionUpdater interface {
	UpdatePosition(ideaId int64, index int, change invest.PositionChange) error
}

// get position
type PositionProvider interface {
	GetPosition(id int64) (invest.Position, error)
}

var (
	database = inmem.New()

	ideaSaver        IdeaSaver        = database
	ideaUpdater      IdeaUpdater      = database
	ideaProvider     IdeaProvider     = mock.NewRandIdeaGen()
	positionUpdater  PositionUpdater  = database
	positionProvider PositionProvider = mock.NewRandPosGen()
)

func RunServer() {
	r := chi.NewRouter()

	r.Use(render.SetContentType(render.ContentTypeJSON))
	r.Use(middleware.Logger)

	r.Route("/api", apiRouter)

	http.ListenAndServe(":80", r)
}

func apiRouter(r chi.Router) {
	r.Route("/idea", ideaRouter)
	r.Route("/position", positionRouter)
}

func ideaRouter(r chi.Router) {
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

		ideaJson, _ := json.Marshal(idea)
		fmt.Fprintln(w, string(ideaJson))
	})

	r.Post("/", func(w http.ResponseWriter, r *http.Request) {
		var idea invest.Idea

		err := json.NewDecoder(r.Body).Decode(&idea)
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
		var idea invest.Idea

		err := json.NewDecoder(r.Body).Decode(&idea)
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

func positionRouter(r chi.Router) {
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

		positionJson, _ := json.Marshal(position)
		fmt.Fprintln(w, string(positionJson))
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
