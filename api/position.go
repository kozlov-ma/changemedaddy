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
	GetPosition(ideaId int64, idx int) (invest.Position, error)
}

// update position
type PositionUpdater interface {
	UpdatePosition(ideaId int64, idx int, pos invest.Position) error
}

func routePositions(r chi.Router) {
	r.Get("/idea/{id}/position/{idx}", getPositionHandler)
	r.Patch("/idea/{id}/position/{idx}", patchPositionHandler)
}

func getPositionHandler(w http.ResponseWriter, r *http.Request) {
	id, err1 := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	idx, err2 := strconv.Atoi(chi.URLParam(r, "idx"))
	if err1 != nil || err2 != nil {
		w.WriteHeader(400)
		fmt.Fprintf(w, "bad id or idx")
		return
	}

	position, err := server.PositionProvider.GetPosition(id, idx)
	if errors.Is(err, db.PositionDoesNotExistError) {
		w.WriteHeader(404)
		return
	}

	positionJson, _ := json.Marshal(position)
	fmt.Fprintln(w, string(positionJson))
}

func patchPositionHandler(w http.ResponseWriter, r *http.Request) {
	id, err1 := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	idx, err2 := strconv.Atoi(chi.URLParam(r, "idx"))
	if err1 != nil || err2 != nil {
		w.WriteHeader(400)
		fmt.Fprintf(w, "bad id or idx")
		return
	}

	var ch invest.PositionChange
	_ = render.Decode(r, ch)

	pos, _ := server.PositionProvider.GetPosition(id, idx)
	pos = ch.Apply(pos)

	err := server.PositionUpdater.UpdatePosition(id, idx, pos)
	if errors.Is(err, db.PositionDoesNotExistError) {
		w.WriteHeader(404)
		return
	}

	fmt.Fprintf(w, "position updated")
}
