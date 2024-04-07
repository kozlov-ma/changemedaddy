package api

import (
	"changemedaddy/db"
	"changemedaddy/invest"
	"changemedaddy/market"
	"context"
	"errors"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"net/http"
	"strconv"
)

// get position
type PositionProvider interface {
	GetPosition(ctx context.Context, id int64) (pos invest.Position, err error)
}

// add position
type PositionAdder interface {
	AddPosition(ctx context.Context, pos invest.Position) (id int64, err error)
}

type MarketProvider interface {
	Price(ctx context.Context, instrument invest.InstrumentType, ticker string) (float64, error)
}

func (api API) handleGetPosition(w http.ResponseWriter, r *http.Request) {
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

	if err = render.Render(w, r, NewPageData(api.NewPositionResponse(id, &pos, curPrice))); err != nil {
		render.Render(w, r, ErrRender(err))
	}
}

func (api API) handlePostPosition(w http.ResponseWriter, r *http.Request) {
	var pr PositionRequest
	if err := render.Bind(r, &pr); err != nil {
		render.Render(w, r, ErrInvalidRequest(err))
		return
	}

	pos := pr.ToPosition()

	curPrice, err := api.market.Price(r.Context(), pos.InstrumentType, pos.Ticker)
	if errors.Is(err, market.ErrInstrumentDoesNotExist) {
		render.Render(w, r, ErrInvalidRequest(err))
		return
	} else if err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}

	id, err := api.db.AddPosition(r.Context(), pos)
	if err != nil {
		render.Render(w, r, ErrInternal(err))
	}

	if err := render.Render(w, r, api.NewPositionResponse(id, &pos, curPrice)); err != nil {
		render.Render(w, r, ErrRender(err))
	}
}
