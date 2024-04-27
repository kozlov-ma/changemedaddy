package api

import (
	"changemedaddy/internal/aggregate/idea"
	"changemedaddy/internal/ui"
	"errors"
	"strconv"

	"github.com/labstack/echo/v4"
)

func (h *handler) getIdea(c echo.Context) error {
	idS := c.Param("id")
	id, err := strconv.Atoi(idS)
	if err != nil {
		h.log.Debug("tried to get idea with wrong id", "id", id, "err", err)
	}

	i, err := h.ir.Find(c.Request().Context(), id)
	if errors.Is(err, idea.ErrNotFound) {
		h.log.Debug("couldn't find idea: given id does not exist", "id", id)
		return ui.Render404(c)
	} else if err != nil {
		h.log.Error("couldn't find idea", "id", id, "err", err)
		return ui.Render500(c)
	}

	return ui.Idea(i).Render(c)
}
