package api

import (
	"changemedaddy/db"
	"changemedaddy/invest"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/go-chi/chi/v5"
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

func routeIdeas(r chi.Router) {
	r.Get("/idea/{id}", getIdeaHandler)
	r.Post("/idea", postIdeaHandler)
	r.Patch("/idea/{id}", patchIdeaHandler)
}

func getIdeaHandler(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		w.WriteHeader(400)
		fmt.Fprintln(w, "bad id")
		return
	}

	idea, err := server.IdeaProvider.GetIdea(id)
	if errors.Is(err, db.IdeaDoesNotExistError) {
		w.WriteHeader(404)
		return
	}

	ideaJson, _ := json.Marshal(idea)
	fmt.Fprintln(w, string(ideaJson))
}

func postIdeaHandler(w http.ResponseWriter, r *http.Request) {
	var idea invest.Idea

	err := json.NewDecoder(r.Body).Decode(&idea)
	if err != nil {
		w.WriteHeader(400)
		return
	}

	id, err := server.IdeaSaver.AddIdea(idea)
	if err != nil {
		w.WriteHeader(400)
		return
	}

	fmt.Fprintf(w, "done with id %v", id)
}

func patchIdeaHandler(w http.ResponseWriter, r *http.Request) {
	var ch invest.IdeaChange
	err := json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		w.WriteHeader(400)
		return
	}

	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	idea, _ := server.IdeaProvider.GetIdea(id)

	idea = ch.Apply(idea)
	_ = server.IdeaUpdater.UpdateIdea(id, idea)

	fmt.Fprintf(w, "ch updated")
}
