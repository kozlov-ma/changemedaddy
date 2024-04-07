package api

import (
	"changemedaddy/db"
	"changemedaddy/invest"
	"changemedaddy/server/core"
	"errors"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"net/http"
	"strconv"
)

func handleChange[T invest.PositionChange](api API) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			render.Render(w, r, core.ErrInvalidRequest(err))
			return
		}

		var change T
		if err = render.DecodeJSON(r.Body, &change); err != nil {
			render.Render(w, r, core.ErrInvalidRequest(err))
			return
		}

		if err = validate.Struct(change); err != nil {
			render.Render(w, r, core.ErrInvalidRequest(err))
			return
		}

		pos, err := api.db.GetPosition(r.Context(), id)
		if errors.Is(err, db.ErrPositionDoesNotExist) {
			render.Render(w, r, core.ErrNotFound)
			return
		} else if err != nil {
			render.Render(w, r, core.ErrInternal(err))
			return
		}

		if err := change.Check(pos); err != nil {
			render.Render(w, r, core.ErrInvalidRequest(err))
			return
		}

		pos = change.Apply(pos)

		if err := api.db.PutPosition(r.Context(), id, pos); err != nil {
			render.Render(w, r, core.ErrInternal(err))
			return
		}

		curPrice, err := api.market.Price(r.Context(), pos.InstrumentType, pos.Ticker)
		if err != nil {
			render.Render(w, r, core.ErrInternal(err))
			return
		}

		if err := render.Render(w, r, core.NewPositionResponse(id, &pos, curPrice)); err != nil {
			render.Render(w, r, core.ErrRender(err))
		}
	}
}
