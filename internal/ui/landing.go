package ui

import "github.com/labstack/echo/v4"

func Landing(c echo.Context) error {
	return c.Render(200, "landing.html", nil)
}
