package ui

import "github.com/labstack/echo/v4"

func Render400(c echo.Context) error {
	return c.Render(400, "400.html", nil)
}

func Render404(c echo.Context) error {
	return c.Render(404, "404.html", nil)
}

func Render500(c echo.Context) error {
	return c.Render(500, "500.html", nil)
}

func Render401(c echo.Context) error {
	return c.Render(401, "401.html", nil)
}
