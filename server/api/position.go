package api

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"

	"changemedaddy/db"
	"changemedaddy/market"
	"changemedaddy/server/core"
)

func (api *API) handleGetPosition(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
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

	curPrice, err := api.market.Price(r.Context(), pos.InstrumentType, pos.Ticker)
	if err != nil {
		render.Render(w, r, core.ErrInternal(err))
		return
	}

	if err := render.Render(w, r, core.NewPositionResponse(id, &pos, curPrice)); err != nil {
		render.Render(w, r, core.ErrRender(err))
	}
}

func (api *API) handlePostPosition(w http.ResponseWriter, r *http.Request) {
	var pr core.PositionRequest
	if err := render.Bind(r, &pr); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	pos := pr.ToPosition()

	curPrice, err := api.market.Price(r.Context(), pos.InstrumentType, pos.Ticker)
	if errors.Is(err, market.ErrInstrumentDoesNotExist) {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	} else if err != nil {
		render.Render(w, r, core.ErrInternal(err))
		return
	}

	id, err := api.db.AddPosition(r.Context(), pos)
	if err != nil {
		render.Render(w, r, core.ErrInternal(err))
	}

	if err := render.Render(w, r, core.NewPositionResponse(id, &pos, curPrice)); err != nil {
		render.Render(w, r, core.ErrRender(err))
	}
}
