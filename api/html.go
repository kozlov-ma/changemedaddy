package api

import (
	"changemedaddy/db"
	"changemedaddy/view"
	"changemedaddy/web"
	"errors"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"net/http"
	"strconv"
)

func (api API) handleGetPage(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
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

	curPrice, err := api.market.Price(r.Context(), pos.InstrumentType, pos.Ticker)
	if err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}

	if err = web.PageTmpl.Execute(w, web.NewPageData(view.NewPositionResponse(id, &pos, curPrice))); err != nil {
		render.Render(w, r, ErrRender(err))
	}
}
