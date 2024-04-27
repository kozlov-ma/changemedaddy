package api

import (
	"changemedaddy/internal/domain/position"
	"changemedaddy/internal/ui"
	"errors"
	"strconv"

	"github.com/labstack/echo/v4"
)

func (h *handler) getPosition(c echo.Context) error {
	param := c.Param("id")
	id, err := strconv.Atoi(param)
	if err != nil {
		h.log.Debug("tried to get position with wrong id", "id", id, "err", err)
		return err
	}

	ctx := c.Request().Context()
	p, err := h.pos.Find(ctx, id)
	if errors.Is(err, position.ErrNotFound) {
		h.log.Debug("couldn't find position: given id does not exist", "id", param)
		return ui.Render404(c)
	} else if err != nil {
		h.log.Error("couldn't find position", "id", param, "err", err)
		return ui.Render500(c)
	}

	wp, err := p.WithProfit(ctx, h.mp)
	if err != nil {
		h.log.Error("couldn't get price for position", "id", param, "err", err)
		return c.Render(500, "500.html", nil)
	}

	return ui.Position(wp).Render(c)
}
