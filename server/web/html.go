package web

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"changemedaddy/db"
	"changemedaddy/server/core"
)

func (web *Web) handleGetPage(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		ErrorTmpl.Execute(w, core.ErrInvalidRequest(err))
		return
	}

	pos, err := web.db.GetPosition(r.Context(), id)
	if errors.Is(err, db.ErrPositionDoesNotExist) {
		ErrorTmpl.Execute(w, core.ErrNotFound)
		return
	} else if err != nil {
		ErrorTmpl.Execute(w, core.ErrInternal(err))
		return
	}

	curPrice, err := web.market.Price(r.Context(), pos.InstrumentType, pos.Ticker)
	if err != nil {
		ErrorTmpl.Execute(w, core.ErrInternal(err))
		return
	}

	if err = PageTmpl.Execute(w, NewPageData(core.NewPositionResponse(id, &pos, curPrice))); err != nil {
		ErrorTmpl.Execute(w, core.ErrRender(err))
	}
}
