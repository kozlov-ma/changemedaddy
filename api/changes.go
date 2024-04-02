package api

import (
	"changemedaddy/db"
	"changemedaddy/invest"
	"context"
	"errors"
	"fmt"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"net/http"
	"strconv"
)

// change existing position
type PositionPutter interface {
	PutPosition(ctx context.Context, id int64, pos invest.Position) error
}

func handleChange[T invest.PositionChange](api API) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			w.WriteHeader(400)
			fmt.Fprintf(w, "bad id or idx")
			return
		}

		var ch T
		_ = render.DecodeJSON(r.Body, &ch)

		_ = api.validate.Struct(ch)

		pos, _ := api.db.GetPosition(r.Context(), id)
		err = ch.Check(pos)
		if err != nil {
			w.WriteHeader(400)
			fmt.Fprintf(w, err.Error())
			return
		}

		pos = ch.Apply(pos)
		err = api.db.PutPosition(r.Context(), id, pos)
		if errors.Is(err, db.PositionDoesNotExistError) {
			w.WriteHeader(404)
			return
		}

		fmt.Fprintf(w, "position updated")
	}
}