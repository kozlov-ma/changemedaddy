package api

import (
	"github.com/labstack/echo/v4"
)

func (h *handler) getLanding(c echo.Context) error {
	return c.Render(200, "landing.html", struct{}{})
}
