package api

import (
	"changemedaddy/db"
	"changemedaddy/invest"
	"changemedaddy/view"
	"context"
	"errors"
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
			render.Render(w, r, ErrInvalidRequest(err))
			return
		}

		var change T
		if err := render.DecodeJSON(r.Body, &change); err != nil {
			render.Render(w, r, ErrInvalidRequest(err))
			return
		}

		if err := validate.Struct(change); err != nil {
			render.Render(w, r, ErrInvalidRequest(err))
			return
		}

		pos, err := api.db.GetPosition(r.Context(), id)
		if errors.Is(err, db.ErrPositionDoesNotExist) {
			render.Render(w, r, ErrNotFound)
			return
		} else if err != nil {
			render.Render(w, r, ErrInternal(err))
			return
		}

		if err := change.Check(pos); err != nil {
			render.Render(w, r, ErrInvalidRequest(err))
			return
		}

		pos = change.Apply(pos)

		if err := api.db.PutPosition(r.Context(), id, pos); err != nil {
			render.Render(w, r, ErrInternal(err))
			return
		}

		curPrice, err := api.market.Price(r.Context(), pos.InstrumentType, pos.Ticker)
		if err != nil {
			render.Render(w, r, ErrInternal(err))
			return
		}

		if err := render.Render(w, r, view.NewPositionResponse(id, &pos, curPrice)); err != nil {
			render.Render(w, r, ErrRender(err))
		}
	}
}
