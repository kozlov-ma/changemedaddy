package api

import (
	"changemedaddy/db"
	"changemedaddy/invest"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"net/http"
	"strconv"
)

// get position
type PositionProvider interface {
	GetPosition(id int64) (pos invest.Position, err error)
}

// add position
type PositionAdder interface {
	AddPosition(pos invest.Position) (id int64, err error)
}

func (api API) handleGetPosition(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		w.WriteHeader(400)
		fmt.Fprintf(w, "bad id")
	}

	position, err := api.db.GetPosition(id)
	if errors.Is(err, db.PositionDoesNotExistError) {
		w.WriteHeader(404)
		return
	}

	positionJson, _ := json.Marshal(position)
	fmt.Fprintln(w, string(positionJson))
}

func (api API) handlePostPosition(w http.ResponseWriter, r *http.Request) {
	var pos invest.Position
	err := render.DecodeJSON(r.Body, &pos)
	if err != nil {
		w.WriteHeader(400)
		return
	}

	err = api.validate.Struct(pos)
	if err != nil || len(pos.Log) != 0 {
		w.WriteHeader(400)
		return
	}

	id, err := api.db.AddPosition(pos)
	if err != nil {
		w.WriteHeader(500)
		return
	}

	w.WriteHeader(200)
	fmt.Fprintf(w, "done with id %v", id)
}
