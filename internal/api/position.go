package api

import (
	"changemedaddy/internal/aggregate/idea"
	"changemedaddy/internal/domain/position"
	"changemedaddy/internal/ui"
	"errors"
	"strconv"

	"github.com/labstack/echo/v4"
)

func (h *handler) positionMW(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		param := c.Param("positionID")
		id, err := strconv.Atoi(param)
		if err != nil {
			h.log.Debug("tried to get position with wrong id", "id", param, "err", err)
			return c.Redirect(307, "/404")
		}

		ctx := c.Request().Context()
		p, err := h.pos.Find(ctx, id)
		if errors.Is(err, position.ErrNotFound) {
			h.log.Debug("couldn't find position: given id does not exist", "id", param)
			return c.Redirect(307, "/404")
		} else if err != nil {
			h.log.Error("couldn't find position", "id", param, "err", err)
			return c.Redirect(307, "/500")
		}

		c.Set("position", p)
		return next(c)
	}
}

func (h *handler) getPosition(c echo.Context) error {
	i := c.Get("idea").(*idea.Idea)
	p := c.Get("position").(*position.Position)

	ctx := c.Request().Context()
	wp, err := p.WithProfit(ctx, h.mp)
	if err != nil {
		h.log.Error("couldn't get price for position", "id", p.ID, "err", err)
		return c.Redirect(307, "/500")
	}

	isOwner := c.Get("isOwner").(bool)
	return ui.Position(isOwner, i.AuthorSlug, i.Slug, wp).Render(c)
}

func (h *handler) editPositionForm(c echo.Context) error {
	i := c.Get("idea").(*idea.Idea)
	p := c.Get("position").(*position.Position)
	return ui.EditPosition(i.AuthorSlug, i.Slug, p).Render(c)
}

func (h *handler) editPosition(c echo.Context) error {
	i := c.Get("idea").(*idea.Idea)
	p := c.Get("position").(*position.Position)

	var opt position.ChangeOptions
	if err := c.Bind(&opt); err != nil {
		h.log.Warn("couldn't bind position change options", "err", err)
		return c.Redirect(307, "/400")
	}

	ctx := c.Request().Context()
	wp, err := p.WithProfit(ctx, h.mp)
	if err != nil {
		h.log.Error("couldn't get price for position", "id", p.ID, "err", err)
		return c.Redirect(307, "/500")
	}

	if err := wp.ApplyChange(ctx, opt, h.pos); err != nil {
		if errors.Is(err, position.ErrTargetPrice) || errors.Is(err, position.ErrParseDeadline) {
			return ui.PositionEditForm{
				ID:            wp.ID,
				Name:          wp.Instrument.Name,
				Ticker:        wp.Instrument.Ticker,
				AuthorSlug:    i.AuthorSlug,
				IdeaSlug:      i.Slug,
				Type:          string(wp.Type),
				TargetHint:    wp.TargetPrice.String(),
				PrevTarget:    opt.TargetPrice,
				WrongTarget:   errors.Is(err, position.ErrTargetPrice),
				DeadlineHint:  wp.Deadline,
				PrevDeadline:  opt.Deadline,
				WrongDeadline: errors.Is(err, position.ErrParseDeadline),
			}.Render(c)
		} else {
			h.log.Error("couldn't apply changes to position", "err", err, "id", wp.ID)
		}
	}

	return ui.Position(true, i.AuthorSlug, i.Slug, wp).Render(c)
}
