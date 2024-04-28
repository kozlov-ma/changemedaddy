package api

import (
	"changemedaddy/internal/aggregate/idea"
	"changemedaddy/internal/domain/position"
	"changemedaddy/internal/ui"
	"errors"
	"strconv"

	"github.com/labstack/echo/v4"
)

func (h *handler) ideaMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		idS := c.Param("ideaID")
		id, err := strconv.Atoi(idS)
		if err != nil {
			h.log.Debug("tried to get idea with wrong id", "id", id, "err", err)
			ui.Render404(c)
			return err
		}

		i, err := h.ir.Find(c.Request().Context(), id)
		if errors.Is(err, idea.ErrNotFound) {
			h.log.Debug("couldn't find idea: given id does not exist", "id", id)
			ui.Render404(c)
			return err
		} else if err != nil {
			h.log.Error("couldn't find idea", "id", id, "err", err)
			ui.Render500(c)
			return err
		}

		c.Set("idea", i)
		return next(c)
	}
}

func (h *handler) getIdea(c echo.Context) error {
	i := c.Get("idea").(*idea.Idea)
	return ui.Idea(i).Render(c)
}

func (h *handler) addPosition(c echo.Context) error {
	var opt position.CreationOptions
	if err := c.Bind(&opt); err != nil {
		h.log.Debug("couldn't bind position creation options", "err", err)
		ui.Render400(c)
		return err
	}

	i := c.Get("idea").(*idea.Idea)
	p, err := i.NewPosition(c.Request().Context(), h.mp, h.pos, h.ir, opt)
	if errors.Is(err, position.ErrTicker) || errors.Is(err, position.ErrParseType) || errors.Is(err, position.ErrTargerPrice) || errors.Is(err, position.ErrParseDeadline) {
		pf := ui.PositionForm{
			IdeaID:        i.ID,
			PrevTicker:    opt.Ticker,
			WrongTicker:   errors.Is(err, position.ErrTicker),
			PrevTarget:    opt.TargetPrice,
			WrongTarget:   errors.Is(err, position.ErrTargerPrice),
			WrongType:     errors.Is(err, position.ErrParseType),
			PrevDeadline:  opt.Deadline,
			WrongDeadline: errors.Is(err, position.ErrParseDeadline),
		}
		return pf.Render(c)
	} else if err != nil {
		h.log.Error("couldn't create position", "err", err)
		ui.Render500(c)
		return err
	}

	wp, err := p.WithProfit(c.Request().Context(), h.mp)
	if err != nil {
		h.log.Error("couldn't get profit info for position", "id", p.ID, "err", err)
		ui.Render500(c)
		return err
	}

	return ui.Position(wp).Render(c)
}

func (h *handler) positionForm(c echo.Context) error {
	i := c.Get("idea").(*idea.Idea)
	return ui.NewPosition(i.ID).Render(c)
}
